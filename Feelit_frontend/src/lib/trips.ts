import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "./api";
import type { Trip, TripUpdate } from "./types";

/** Delete a trip and refresh every list that shows it. */
export function useDeleteTrip(onDone?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTrip(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ["trip", id] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast("Trip deleted.");
      onDone?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Save edits to a trip and update the cached copy. */
export function useSaveTrip(id: string, onDone?: (trip: Trip) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: TripUpdate) => api.updateTrip(id, changes),
    onSuccess: (trip) => {
      queryClient.setQueryData(["trip", id], trip);
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Trip saved.");
      onDone?.(trip);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
