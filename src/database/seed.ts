import { hash } from 'argon2';
import { createRequire } from 'node:module';
try {
  process.loadEnvFile('.env');
} catch {}
const require = createRequire(import.meta.url);
const { Pool } = require('pg') as {
  Pool: new (options: object) => {
    query<T>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
    end(): Promise<void>;
  };
};
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const categories = [
  'التكييف والتبريد',
  'الأنظمة الكهربائية',
  'السباكة',
  'المنزل الذكي',
  'النجارة',
  'الصيانة العامة',
];
const courses = [
  [
    'ac-basics',
    'أساسيات التكييف والتبريد',
    0,
    'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=900&q=80',
  ],
  [
    'electrical-basics',
    'التمديدات الكهربائية للمبتدئين',
    1,
    'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=900&q=80',
  ],
  [
    'plumbing-basics',
    'أساسيات السباكة والصيانة',
    2,
    'https://images.unsplash.com/photo-1585704032915-c3400ca199e7e?auto=format&fit=crop&w=900&q=80',
  ],
  [
    'smart-home',
    'مدخل إلى أنظمة المنزل الذكي',
    3,
    'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&w=900&q=80',
  ],
  [
    'carpentry',
    'تعلم النجارة خطوة بخطوة',
    4,
    'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80',
  ],
  [
    'maintenance',
    'مهارات الصيانة العملية',
    5,
    'https://images.unsplash.com/photo-1581147036324-c1c7624e0e7e?auto=format&fit=crop&w=900&q=80',
  ],
];
async function seed() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  await pool.query('BEGIN');
  try {
    for (const title of categories)
      await pool.query(
        `INSERT INTO categories(title) VALUES($1) ON CONFLICT(title) DO NOTHING`,
        [title],
      );
    const currentInstructor = await pool.query<{ id: string }>(
      `SELECT id::text AS id FROM instructors WHERE name=$1 LIMIT 1`,
      ['فريق مدربي كفاءات'],
    );
    const instructor = currentInstructor.rows[0]
      ? currentInstructor
      : await pool.query<{ id: string }>(
          `INSERT INTO instructors(name,bio) VALUES($1,$2) RETURNING id::text AS id`,
          [
            'فريق مدربي كفاءات',
            'خبراء مهنيون يقدمون محتوى عمليًا مبنيًا على خبرة ميدانية.',
          ],
        );
    const id = instructor.rows[0]!.id;
    for (const [slug, title, index, thumbnail] of courses) {
      const category = (
        await pool.query<{ id: string }>(
          `SELECT id::text AS id FROM categories WHERE title=$1`,
          [categories[index as number]],
        )
      ).rows[0]!;
      await pool.query(
        `INSERT INTO courses(slug,title,description,thumbnail_url,is_published,instructor_id,category_id) VALUES($1,$2,$3,$4,true,$5,$6) ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,thumbnail_url=EXCLUDED.thumbnail_url`,
        [
          slug,
          title,
          `دورة عملية في ${categories[index as number]} تبدأ من الأساسيات وتنتقل إلى خطوات العمل والتطبيق الآمن.`,
          thumbnail,
          id,
          category.id,
        ],
      );
    }
    const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase(),
      password = process.env.SEED_ADMIN_PASSWORD;
    if (email && password)
      await pool.query(
        `INSERT INTO users(name,email,phone,password_hash,role) VALUES($1,$2,$3,$4,'super_admin') ON CONFLICT(email) DO NOTHING`,
        [
          process.env.SEED_ADMIN_NAME?.trim() || 'مدير المنصة',
          email,
          process.env.SEED_ADMIN_PHONE || '+966500000000',
          await hash(password),
        ],
      );
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}
try {
  await seed();
  console.log('Seed completed');
} finally {
  await pool.end();
}
