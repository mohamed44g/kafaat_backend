export interface UserVideoProgress {
  id: string;
  userId: string;
  videoId: string;
  isCompleted: boolean;
  watchedDuration: number;
  updatedAt: Date;
}
