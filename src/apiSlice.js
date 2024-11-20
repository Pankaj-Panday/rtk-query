import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const api = createApi({
  baseQuery: fetchBaseQuery({
    baseUrl: "http://localhost:3000",
  }),
  tagTypes: ["Tasks"],
  endpoints: (builder) => ({
    getTasks: builder.query({
      query: () => "/tasks",
      providesTags: ["Tasks"],
      transformResponse: (tasks) => tasks.reverse(),
    }),
    addTask: builder.mutation({
      query: (task) => ({
        url: "/tasks",
        method: "POST",
        body: task,
      }),
      // don't use tags when using optimistic updates
      // invalidatesTags: ["Tasks"],

      async onQueryStarted(task, { dispatch, queryFulfilled }) {
        // Generate a temporary ID for optimistic update
        const tempId = crypto.randomUUID();

        // Optimistically add the task to the cache
        const getTasksPatchResult = dispatch(
          api.util.updateQueryData("getTasks", undefined, (cachedTasks) => {
            cachedTasks.unshift({ id: tempId, ...task });
          })
        );

        try {
          // Wait for the server to respond with the real task
          const { data: createdTask } = await queryFulfilled;

          // Update the cache to replace the temp ID with the server-generated ID
          dispatch(
            api.util.updateQueryData("getTasks", undefined, (cachedTasks) => {
              const index = cachedTasks.findIndex((task) => task.id === tempId);
              if (index !== -1) {
                cachedTasks[index] = createdTask; // Replace with the server response
              }
            })
          );
        } catch {
          // Rollback the optimistic update if the mutation fails
          getTasksPatchResult.undo();
        }
      },
    }),
    updateTask: builder.mutation({
      query: ({ id, ...updatedTask }) => ({
        url: `/tasks/${id}`,
        method: "PATCH",
        body: updatedTask,
      }),
      async onQueryStarted(
        { id, ...updatedTask },
        { dispatch, queryFulfilled }
      ) {
        const getTasksPatchResult = dispatch(
          api.util.updateQueryData("getTasks", undefined, (cachedTasks) => {
            const index = cachedTasks.findIndex((task) => task.id === id);
            if (index !== -1) {
              cachedTasks[index] = { ...cachedTasks[index], ...updatedTask };
            }
          })
        );
        try {
          await queryFulfilled;
        } catch {
          getTasksPatchResult.undo();
        }
      },
      // invalidatesTags: ["Tasks"],
    }),
    deleteTask: builder.mutation({
      query: (id) => ({
        url: `/tasks/${id}`,
        method: "DELETE",
      }),
      // invalidatesTags: ["Tasks"],
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const getTasksPatchResult = dispatch(
          api.util.updateQueryData("getTasks", undefined, (cachedTasks) => {
            return cachedTasks.filter((task) => task.id !== id);
          })
        );
        try {
          await queryFulfilled;
        } catch {
          getTasksPatchResult.undo();
        }
      },
    }),
  }),
});

export const {
  useGetTasksQuery,
  useAddTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
} = api;
