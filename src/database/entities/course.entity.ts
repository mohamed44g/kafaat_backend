import type { Category } from './category.entity.js';
import type { Instructor } from './instructor.entity.js';
import type { Video } from './video.entity.js';

export interface Course {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  totalTime: string;
  totalVideo: number;
  isPublished: boolean;
  instructorId: string;
  categoryId: string;
  createdAt: Date;
  instructor?: Instructor;
  category?: Category;
  videos?: Video[];
}
