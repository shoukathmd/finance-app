import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/hono";

type CategoriesResponseType = InferResponseType<
  typeof client.api.categories.$post
>;
type CategoriesRequestType = InferRequestType<
  typeof client.api.categories.$post
>["json"];

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<
    CategoriesResponseType,
    Error,
    CategoriesRequestType
  >({
    mutationFn: async (json) => {
      const response = await client.api.categories.$post({ json });
      return await response.json();
    },
    onSuccess: () => {
      toast.success("Category created");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: () => {
      toast.error("Failed to create category");
    },
  });

  return mutation;
};
