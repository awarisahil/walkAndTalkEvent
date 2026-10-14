import client from "./client";
import { unwrap } from "./auth";
import type {
  CommunityMediaType,
  CommunityPost,
  CommunityUploadResponse,
  CreateCommunityPostPayload,
} from "../types";

export async function fetchCommunityPosts(params: {
  eventId?: string;
  mediaType?: CommunityMediaType;
} = {}): Promise<CommunityPost[]> {
  const res = await client.get("/community", { params });
  return unwrap<CommunityPost[]>(res);
}

export async function createCommunityPost(
  payload: CreateCommunityPostPayload,
): Promise<CommunityPost> {
  const res = await client.post("/community", payload);
  return unwrap<CommunityPost>(res);
}

export async function deleteCommunityPost(id: string): Promise<{ id: string }> {
  const res = await client.delete(`/community/${id}`);
  return unwrap<{ id: string }>(res);
}

/**
 * Uploads a photo/video file. The browser sets the multipart Content-Type
 * (with boundary) automatically — the client must NOT set one explicitly.
 */
export async function uploadCommunityMedia(
  file: File,
): Promise<CommunityUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await client.post("/community/upload", formData);
  return unwrap<CommunityUploadResponse>(res);
}
