/** R2 object key — 서버 전용. 클라이언트 입력 무시. */

export function buildCollabProjectFileStorageKey(projectId: number, fileId: number): string {
  return `arklux/projects/${projectId}/files/${fileId}`;
}

export function buildCollabReplyFileStorageKey(
  projectId: number,
  replyId: number,
  fileId: number,
): string {
  return `arklux/projects/${projectId}/replies/${replyId}/files/${fileId}`;
}
