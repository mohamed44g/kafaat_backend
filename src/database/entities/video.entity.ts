export interface Video {
  id: string;
  title: string;
  description: string | null;
  isFree: boolean;
  position: number;
  durationSeconds: number;
  bunnyVideoId: string | null;
  streamStatus: string;
  thumbnailUrl: string | null;
  lastStreamEventAt: Date | null;
  courseId: string;
  createdAt: Date;
  updatedAt: Date;
}
