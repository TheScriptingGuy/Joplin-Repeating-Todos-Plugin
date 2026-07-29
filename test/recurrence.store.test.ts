import joplin, { resetJoplinMock } from "./mocks/api";
import { ModelType } from "./mocks/api-types";
import { RecurrenceStore } from "../src/core/database";
import { Recurrence } from "../src/model/recurrence";

// Helpers ----------------------------------------------------------------

// A full RecurrenceData-shaped object used to drive userDataGet.
const sampleData = {
  enabled: true,
  interval: "week",
  intervalNumber: 2,
  weekSunday: false,
  weekMonday: true,
  weekTuesday: false,
  weekWednesday: false,
  weekThursday: false,
  weekFriday: true,
  weekSaturday: false,
  monthOrdinal: "first",
  monthWeekday: "",
  stopType: "never",
  stopDate: null,
  stopNumber: 1,
};

// Builds a jest implementation for joplin.data.get that branches on the path array.
function mockDataGet(handlers: {
  tags?: any;
  tagNotes?: any;
  note?: any;
}): void {
  (joplin.data.get as jest.Mock).mockImplementation(async (path: string[]) => {
    if (path[0] === "tags" && path.length === 1) {
      return handlers.tags ?? { items: [], has_more: false };
    }
    if (path[0] === "tags" && path[2] === "notes") {
      return handlers.tagNotes ?? { items: [], has_more: false };
    }
    if (path[0] === "notes") {
      return handlers.note ?? { body: "" };
    }
    return { items: [], has_more: false };
  });
}

describe("RecurrenceStore", () => {
  beforeEach(() => {
    resetJoplinMock();
  });

  describe("get", () => {
    it("returns a Recurrence built from userData when userDataGet resolves an object", async () => {
      (joplin.data.userDataGet as jest.Mock).mockResolvedValue(sampleData);

      const result = await RecurrenceStore.get("note-1");

      expect(result).toBeInstanceOf(Recurrence);
      expect(result?.enabled).toBe(true);
      expect(result?.interval).toBe("week");
      expect(result?.intervalNumber).toBe(2);
      expect(result?.weekMonday).toBe(true);
      expect(result?.weekFriday).toBe(true);
      // userData hit means no need to fall back to the note body.
      expect(joplin.data.get).not.toHaveBeenCalled();
    });

    it("returns null when userData is undefined and the body has no frontmatter", async () => {
      (joplin.data.userDataGet as jest.Mock).mockResolvedValue(undefined);
      mockDataGet({ note: { body: "plain text body, nothing special" } });

      const result = await RecurrenceStore.get("note-2");

      expect(result).toBeNull();
    });

    it("migrates legacy YAML frontmatter into userData and strips it from the body", async () => {
      (joplin.data.userDataGet as jest.Mock).mockResolvedValue(undefined);

      const legacyBody = [
        "---",
        "joplin-recurrence:",
        "  enabled: true",
        "  interval: day",
        "  intervalNumber: 3",
        "---",
        "",
        "Real note content here.",
      ].join("\n");

      mockDataGet({
        note: { body: legacyBody },
        tags: { items: [{ id: "tag-1", title: "recurring" }], has_more: false },
      });

      const result = await RecurrenceStore.get("note-3");

      // Migrated recurrence is returned.
      expect(result).toBeInstanceOf(Recurrence);
      expect(result?.enabled).toBe(true);
      expect(result?.interval).toBe("day");
      expect(result?.intervalNumber).toBe(3);

      // userData was written with the migrated object.
      expect(joplin.data.userDataSet).toHaveBeenCalledWith(
        ModelType.Note,
        "note-3",
        "recurrence",
        expect.objectContaining({ enabled: true, interval: "day", intervalNumber: 3 })
      );

      // The body was put back without the frontmatter.
      const putCalls = (joplin.data.put as jest.Mock).mock.calls;
      const bodyPut = putCalls.find(
        (c) => Array.isArray(c[0]) && c[0][0] === "notes" && c[2] && "body" in c[2]
      );
      expect(bodyPut).toBeDefined();
      expect(bodyPut[2].body).not.toContain("joplin-recurrence");
      expect(bodyPut[2].body).toContain("Real note content here.");
    });
  });

  describe("set", () => {
    it("writes the serialized object to userData and applies the index tag", async () => {
      mockDataGet({
        tags: { items: [{ id: "tag-1", title: "recurring" }], has_more: false },
      });

      const recurrence = new Recurrence();
      recurrence.enabled = true;
      recurrence.interval = "month";
      recurrence.intervalNumber = 1;

      await RecurrenceStore.set("note-4", recurrence);

      expect(joplin.data.userDataSet).toHaveBeenCalledWith(
        ModelType.Note,
        "note-4",
        "recurrence",
        expect.objectContaining({ enabled: true, interval: "month", intervalNumber: 1 })
      );

      // Tag association made for the note.
      expect(joplin.data.post).toHaveBeenCalledWith(
        ["tags", "tag-1", "notes"],
        null,
        { id: "note-4" }
      );
    });

    it("creates the tag when it does not yet exist", async () => {
      mockDataGet({ tags: { items: [], has_more: false } });
      (joplin.data.post as jest.Mock).mockImplementation(async (path: string[]) => {
        if (path[0] === "tags" && path.length === 1) return { id: "created-tag" };
        return { id: "new-id" };
      });

      await RecurrenceStore.set("note-5", new Recurrence());

      expect(joplin.data.post).toHaveBeenCalledWith(["tags"], null, { title: "recurring" });
      expect(joplin.data.post).toHaveBeenCalledWith(
        ["tags", "created-tag", "notes"],
        null,
        { id: "note-5" }
      );
    });
  });

  describe("remove", () => {
    it("deletes the recurrence userData", async () => {
      mockDataGet({
        tags: { items: [{ id: "tag-1", title: "recurring" }], has_more: false },
      });

      await RecurrenceStore.remove("note-6");

      expect(joplin.data.userDataDelete).toHaveBeenCalledWith(
        ModelType.Note,
        "note-6",
        "recurrence"
      );
      expect(joplin.data.delete).toHaveBeenCalledWith(["tags", "tag-1", "notes", "note-6"]);
    });

    it("ignores errors when removing the note from the tag", async () => {
      mockDataGet({
        tags: { items: [{ id: "tag-1", title: "recurring" }], has_more: false },
      });
      (joplin.data.delete as jest.Mock).mockRejectedValue(new Error("already gone"));

      await expect(RecurrenceStore.remove("note-7")).resolves.toBeUndefined();
      expect(joplin.data.userDataDelete).toHaveBeenCalled();
    });
  });

  describe("getAllRecurringTodos", () => {
    it("returns only todos that have recurrence data", async () => {
      const recurrenceById: Record<string, any> = {
        "todo-1": sampleData,
        "todo-2": { ...sampleData, interval: "day" },
        "todo-3": undefined, // orphaned tag, no recurrence
      };

      // userDataGet branches on the note id (3rd-to-last arg is itemId).
      (joplin.data.userDataGet as jest.Mock).mockImplementation(
        async (_type: number, itemId: string) => recurrenceById[itemId]
      );

      mockDataGet({
        tags: { items: [{ id: "tag-1", title: "recurring" }], has_more: false },
        tagNotes: {
          items: [
            { id: "todo-1", title: "First", is_todo: 1, todo_due: 100, todo_completed: 0 },
            { id: "todo-2", title: "Second", is_todo: 1, todo_due: 200, todo_completed: 0 },
            { id: "not-todo", title: "Plain note", is_todo: 0, todo_due: 0, todo_completed: 0 },
            { id: "todo-3", title: "Orphan", is_todo: 1, todo_due: 300, todo_completed: 0 },
          ],
          has_more: false,
        },
      });

      const results = await RecurrenceStore.getAllRecurringTodos();

      expect(results).toHaveLength(2);
      const ids = results.map((r) => r.id).sort();
      expect(ids).toEqual(["todo-1", "todo-2"]);
      for (const todo of results) {
        expect(todo.recurrence).toBeInstanceOf(Recurrence);
        expect(todo.is_todo).toBe(1);
      }
      expect(results.find((r) => r.id === "todo-2")?.recurrence.interval).toBe("day");

      // The orphaned todo should have been removed from the index.
      expect(joplin.data.userDataDelete).toHaveBeenCalledWith(
        ModelType.Note,
        "todo-3",
        "recurrence"
      );
    });

    it("returns an empty array when no recurring tag exists and none can be created", async () => {
      mockDataGet({ tags: { items: [], has_more: false } });
      (joplin.data.post as jest.Mock).mockResolvedValue(null);

      const results = await RecurrenceStore.getAllRecurringTodos();

      expect(results).toEqual([]);
    });
  });

  describe("removeAll", () => {
    it("clears the recurrence data off every indexed note, to-do or not", async () => {
      mockDataGet({
        tags: { items: [{ id: "tag-1", title: "recurring" }], has_more: false },
        tagNotes: {
          items: [{ id: "todo-1" }, { id: "todo-2" }, { id: "not-todo" }],
          has_more: false,
        },
      });

      const cleared = await RecurrenceStore.removeAll();

      expect(cleared).toBe(3);
      for (const id of ["todo-1", "todo-2", "not-todo"]) {
        expect(joplin.data.userDataDelete).toHaveBeenCalledWith(ModelType.Note, id, "recurrence");
        expect(joplin.data.delete).toHaveBeenCalledWith(["tags", "tag-1", "notes", id]);
      }
      // The notes themselves are never written to — alarms and contents are left alone.
      expect(joplin.data.put).not.toHaveBeenCalled();
    });

    it("walks every page of the index", async () => {
      (joplin.data.get as jest.Mock).mockImplementation(async (path: string[], query: any) => {
        if (path[0] === "tags" && path.length === 1) {
          return { items: [{ id: "tag-1", title: "recurring" }], has_more: false };
        }
        if (path[0] === "tags" && path[2] === "notes") {
          return query.page === 1
            ? { items: [{ id: "todo-1" }], has_more: true }
            : { items: [{ id: "todo-2" }], has_more: false };
        }
        return { items: [], has_more: false };
      });

      expect(await RecurrenceStore.removeAll()).toBe(2);
      expect(joplin.data.userDataDelete).toHaveBeenCalledWith(ModelType.Note, "todo-2", "recurrence");
    });

    it("clears nothing when no recurring tag exists and none can be created", async () => {
      mockDataGet({ tags: { items: [], has_more: false } });
      (joplin.data.post as jest.Mock).mockResolvedValue(null);

      expect(await RecurrenceStore.removeAll()).toBe(0);
      expect(joplin.data.userDataDelete).not.toHaveBeenCalled();
    });
  });
});
