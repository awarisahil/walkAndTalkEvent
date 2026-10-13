import client from "./client";
import { unwrap } from "./auth";
import type { UpdateProfilePayload, User } from "../types";

export async function fetchMe(): Promise<User> {
  const res = await client.get("/users/me");
  return unwrap<User>(res);
}

export async function updateMe(payload: UpdateProfilePayload): Promise<User> {
  const res = await client.patch("/users/me", payload);
  return unwrap<User>(res);
}
