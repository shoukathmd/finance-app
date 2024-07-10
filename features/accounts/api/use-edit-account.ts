import { toast } from "sonner";
import { InferRequestType, InferResponseType } from "hono";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { client } from "@/lib/hono";

// Define the response and request types
type ResponseType = InferResponseType<
  (typeof client.api.accounts)[":id"]["$patch"]
>;
type RequestType = InferRequestType<
  (typeof client.api.accounts)[":id"]["$patch"]
>["json"];

export const useEditAccount = (id?: string) => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      console.log("json:", JSON.stringify(json));
      if (!id) {
        throw new Error("Account ID is required for editing");
      }
      const response = await client.api.accounts[":id"]["$patch"]({
        param: { id },
        json,
      });
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      return await response.json();
    },
    onSuccess: () => {
      toast.success("Account updated");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account", { id }] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (error) => {
      toast.error("Failed to edit account: " + error.message);
    },
  });

  return mutation;
};
