# CineVault / viE

> للحفظ الدائم ونقل بيانات `db.json` الحالية تلقائيًا إلى PostgreSQL راجع `POSTGRES_MIGRATION_AR.txt`.

منصة مشاهدة خاصة مبنية بـ React + Vite + Express. تحتوي على أكواد دخول للمشاهدين، مشغل فيديو، حفظ التقدم، لوحة إدارة، إدارة مواسم/حلقات/مصادر فيديو، Google Drive وDirect URL ومصادر HTTP أخرى.

## الدخول المخفي للإدارة

لا يوجد زر Admin ظاهر في الموقع.

1. افتح صفحة إدخال **Access Code** العادية.
2. اكتب: `vin01012007`
3. ستفتح صفحة تسجيل دخول الإدارة.
4. اسم المستخدم: `vin`
5. كلمة المرور: `waswaswas`

الرمز المخفي يتم التحقق منه في السيرفر، ولا يتم وضعه داخل JavaScript الخاص بالواجهة. بعد إدخاله يتم إنشاء تصريح مؤقت لمدة 10 دقائق لفتح نموذج تسجيل الإدارة. واجهات `/api/admin/*` تبقى محمية بجلسة Admin فعلية.

> هذه البيانات مطلوبة كما هي في هذه النسخة. إذا أصبح المستودع عامًا أو شاركت المشروع مع أشخاص آخرين، غيّرها من متغيرات البيئة أو من لوحة الإعدادات.

## تشغيل المشروع محليًا

المطلوب: Node.js 22.12 أو أحدث.

```bash
npm install
npm run dev
```

ثم افتح:

```text
http://localhost:3000
```

الملف `.env` مرفق للتشغيل المحلي، وهو مستثنى من Git عن طريق `.gitignore`.

### أكواد مشاهدة تجريبية

- `DEMO-PASS`
- `CINE-PREMIUM`
- `STREAM-VIP-2026`

الفيديوهات الموجودة في البيانات الأولية هي فيديوهات Demo عامة للاختبار فقط. استبدلها من لوحة الإدارة بمصادر تملك حق استخدامها.

## فحص المشروع وبناء نسخة Production

```bash
npm run check
npm run build
npm start
```

- `npm run check`: فحص TypeScript.
- `npm run build`: يبني React إلى `dist/` ويبني السيرفر إلى `dist-server/server.js`.
- `npm start`: يشغل النسخة المبنية في وضع Production.

يمكن فحص حالة السيرفر من:

```text
/api/health
```

## التخزين الدائم PostgreSQL

هذه النسخة تدعم PostgreSQL مباشرة. عند وجود:

```env
DATABASE_URL="postgresql://..."
```

كل تعديل من لوحة الإدارة يُحفظ تلقائيًا في PostgreSQL: المسلسلات، المواسم، الحلقات، مصادر الفيديو، أكواد الدخول، الجلسات، الإعدادات، سجل التدقيق وتقدم المشاهدة.

### نقل بيانات `db.json` الحالية تلقائيًا

إذا كانت قاعدة PostgreSQL جديدة ولا تحتوي بيانات، CineVault يبحث عن:

```text
data/db.json
```

ويستورد محتواه بالكامل تلقائيًا عند أول تشغيل. الملف القديم لا يتم حذفه بعد الاستيراد ويظل نسخة احتياطية. بعد ذلك تصبح PostgreSQL هي المصدر الرئيسي للحفظ.

إذا لم تضبط `DATABASE_URL`، يبقى المشروع قادرًا على العمل محليًا بالطريقة القديمة باستخدام `data/db.json`.

يمكن التأكد من نوع التخزين الحالي من:

```text
/api/health
```

ويظهر مثلًا:

```json
{
  "database": {
    "backend": "postgres",
    "connected": true
  }
}
```

> طبقة PostgreSQL الحالية تحفظ حالة CineVault كوثيقة JSONB واحدة للحفاظ على توافق كل وظائف اللوحة الحالية. استخدم Replica واحدة للتطبيق لتجنب تعارض تعديل الحالة في نفس اللحظة.

## متغيرات البيئة

```env
NODE_ENV="development"
PORT="3000"
DATABASE_URL=""
DATABASE_SSL="auto"
DATABASE_POOL_SIZE="5"
DATA_DIR="./data"

ADMIN_PORTAL_CODE="vin01012007"
ADMIN_USERNAME="vin"
ADMIN_PASSWORD="waswaswas"
SESSION_SECRET="ضع-قيمة-عشوائية-طويلة-هنا"

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REFRESH_TOKEN=""
GOOGLE_API_KEY=""
```

`ADMIN_USERNAME` و`ADMIN_PASSWORD` يستخدمان للتهيئة الأولى فقط. إذا كانت عندك بيانات سابقة في `db.json` أو PostgreSQL فلن يتم مسح تعديلاتك الحالية.

## النشر على Railway مع PostgreSQL

1. ارفع المشروع إلى GitHub. لا ترفع ملف `.env`.
2. أنشئ خدمة PostgreSQL داخل مشروع Railway.
3. اربط متغير `DATABASE_URL` في خدمة CineVault بعنوان قاعدة PostgreSQL.
4. أضف:

```env
NODE_ENV=production
DATABASE_SSL=auto
ADMIN_PORTAL_CODE=vin01012007
ADMIN_USERNAME=vin
ADMIN_PASSWORD=waswaswas
SESSION_SECRET=<ضع سرًا عشوائيًا طويلًا جدًا>
```

لا تحتاج Volume لحفظ بيانات لوحة الإدارة عندما يكون `DATABASE_URL` متصلًا.

إذا عندك `data/db.json` يحتوي تعديلاتك القديمة، شغّل النسخة الجديدة مرة واحدة في نفس البيئة التي يوجد فيها الملف مع قاعدة PostgreSQL فارغة؛ سيتم استيراده تلقائيًا.

5. Build Command:

```text
npm run build
```

6. Start Command:

```text
npm start
```

7. Health Check:

```text
/api/health
```

بعد النشر تأكد أن `/api/health` يعرض `backend: postgres` و`connected: true`.

## تحسينات الأمان الموجودة

- لا يوجد زر أو رابط Admin ظاهر للمستخدم.
- بوابة الإدارة السرية تُفتح من خانة Access Code فقط.
- التحقق من رمز بوابة الإدارة يتم في السيرفر.
- نموذج Admin Login نفسه لا يقبل الطلب قبل فتح البوابة السرية.
- جلسات Admin تستخدم رموزًا عشوائية ولا يتم حفظ الرمز الخام؛ يتم حفظ SHA-256 فقط.
- Cookies أصبحت `HttpOnly` وبـ `SameSite=Lax` وتتحول إلى `Secure` تلقائيًا في Production.
- لم يعد Admin token محفوظًا في `localStorage`.
- Logout يلغي جلسة المشاهد فعليًا حتى لا تبقى محسوبة ضمن حد الأجهزة.
- جلسات Admin تستمر بعد Restart لأنها محفوظة ضمن قاعدة البيانات.
- Rate limiting على محاولات دخول Admin.
- Security headers وHSTS في Production.
- صفحة API غير المعروفة ترجع JSON 404 بدل صفحة React.

## ملاحظات الفيديو

المتصفح يشاهد من endpoint داخلي مثل:

```text
/api/episodes/:id/stream
```

والسيرفر يقوم بجلب المصدر الحقيقي. هذا يمنع عرض رابط المصدر مباشرة في الواجهة، لكنه لا يجعل نسخ الفيديو مستحيلًا بشكل مطلق. حماية المحتوى الاحترافية تحتاج CDN signed URLs/DRM حسب احتياجك وحقوق المحتوى.
