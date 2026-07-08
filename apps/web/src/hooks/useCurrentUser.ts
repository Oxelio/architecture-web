import { useQuery } from "@tanstack/react-query";
import { getCurrentUser, type CurrentUser } from "../services/api";

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}
