// @file apps/web/src/hooks/useCurrentUser.ts

import { useQuery } from "@tanstack/react-query";

import { type CurrentUser, getCurrentUser } from "#services/api";

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}
