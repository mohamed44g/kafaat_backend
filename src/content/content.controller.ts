import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { UserRole } from '../users/entities/user.entity.js';
import { SubscriptionGuard } from '../common/guards/subscription.guard.js';
import { CreateVideoUploadSessionDto } from '../integrations/bunny-stream/dto/bunny-stream.dto.js';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard.js';
import { ContentService } from './content.service.js';
import {
  COURSE_IMAGE_MAX_BYTES,
  CourseImageService,
} from './course-image.service.js';
import {
  CreateCategoryDto,
  CreateCourseDto,
  CreateInstructorDto,
  CreateVideoDto,
  UpdateCategoryDto,
  UpdateCourseDto,
  UpdateInstructorDto,
  UpdateVideoDto,
} from './dto/content.dto.js';

@ApiTags('catalog')
@Controller()
export class ContentController {
  constructor(
    private readonly content: ContentService,
    private readonly courseImages: CourseImageService,
  ) {}

  @Get('categories')
  @ApiOperation({ summary: 'List course categories' })
  categories() {
    return this.content.listCategories();
  }
  @Get('instructors')
  @ApiOperation({ summary: 'List instructor profiles' })
  instructors() {
    return this.content.listInstructors();
  }
  @Get('courses')
  @ApiOperation({ summary: 'List published courses' })
  courses(@Query('categoryId') categoryId?: string) {
    return this.content.listCourses(categoryId);
  }
  @Get('courses/:slug')
  @ApiOperation({ summary: 'Get published course details and lessons' })
  course(@Param('slug') slug: string) {
    return this.content.getCourse(slug);
  }

  @Get('admin/courses')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'List all courses, including drafts, for admins' })
  adminCourses() {
    return this.content.listAdminCourses();
  }

  @Post('admin/categories')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  createCategory(@Body() input: CreateCategoryDto) {
    return this.content.createCategory(input);
  }
  @Patch('admin/categories/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  updateCategory(@Param('id') id: string, @Body() input: UpdateCategoryDto) {
    return this.content.updateCategory(id, input);
  }
  @Delete('admin/categories/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  removeCategory(@Param('id') id: string) {
    return this.content.removeCategory(id);
  }

  @Post('admin/instructors')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  createInstructor(@Body() input: CreateInstructorDto) {
    return this.content.createInstructor(input);
  }
  @Patch('admin/instructors/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  updateInstructor(
    @Param('id') id: string,
    @Body() input: UpdateInstructorDto,
  ) {
    return this.content.updateInstructor(id, input);
  }
  @Delete('admin/instructors/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  removeInstructor(@Param('id') id: string) {
    return this.content.removeInstructor(id);
  }

  @Post('admin/courses')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  createCourse(@Body() input: CreateCourseDto) {
    return this.content.createCourse(input);
  }
  @Patch('admin/courses/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  updateCourse(@Param('id') id: string, @Body() input: UpdateCourseDto) {
    return this.content.updateCourse(id, input);
  }
  @Delete('admin/courses/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  removeCourse(@Param('id') id: string) {
    return this.content.removeCourse(id);
  }

  @Post('admin/course-images')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { files: 1, fileSize: COURSE_IMAGE_MAX_BYTES, fields: 0 },
    }),
  )
  @ApiOperation({ summary: 'Upload and sanitize a course cover image' })
  uploadCourseImage(@UploadedFile() image?: Express.Multer.File) {
    return this.courseImages.store(image);
  }

  @Delete('admin/course-images/:filename')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Remove an unattached course cover image' })
  removeCourseImage(@Param('filename') filename: string) {
    return this.content.removeUnattachedCourseImage(filename);
  }

  @Post('admin/courses/:courseId/videos')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  createVideo(
    @Param('courseId') courseId: string,
    @Body() input: CreateVideoDto,
  ) {
    return this.content.createVideo(courseId, input);
  }

  @Post('admin/courses/:courseId/videos/upload-session')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Create Bunny TUS direct-upload credentials' })
  createVideoUploadSession(
    @Param('courseId') courseId: string,
    @Body() input: CreateVideoUploadSessionDto,
  ) {
    return this.content.createVideoUploadSession(courseId, input);
  }

  @Post('admin/videos/:id/sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Synchronize a video status from Bunny Stream' })
  syncVideo(@Param('id') id: string) {
    return this.content.syncVideo(id);
  }

  @Get('videos/:videoId/playback')
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard, SubscriptionGuard)
  @ApiOperation({ summary: 'Get a short-lived signed Bunny Player URL' })
  playback(@Param('videoId') videoId: string) {
    return this.content.getVideoPlayback(videoId);
  }
  @Patch('admin/videos/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  updateVideo(@Param('id') id: string, @Body() input: UpdateVideoDto) {
    return this.content.updateVideo(id, input);
  }
  @Delete('admin/videos/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Admin, UserRole.SuperAdmin)
  removeVideo(@Param('id') id: string) {
    return this.content.removeVideo(id);
  }
}
