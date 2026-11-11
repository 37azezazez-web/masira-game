# بناء نسخة الآيفون

المشروع جاهز كتطبيق iOS عن طريق [Capacitor](https://capacitorjs.com/docs/ios) (مجاني ومفتوح المصدر). مجلد `ios/` فيه مشروع Xcode كامل، والأيقونة وشاشة البداية بهوية انتقالات.

## اللي تحتاجه
| الشي | ليش | التكلفة |
|---|---|---|
| جهاز ماك | Xcode يشتغل على الماك بس | — |
| Xcode (من App Store) | لبناء التطبيق وتجربته | مجاني |
| Node.js 20 أو أحدث ([nodejs.org](https://nodejs.org)) | لأوامر Capacitor | مجاني |
| حساب Apple Developer ([developer.apple.com/programs](https://developer.apple.com/programs/)) | للتجربة على جوالك عبر TestFlight والنشر في المتجر | اشتراك سنوي مدفوع (تأكد من السعر وقت التسجيل) |

> تقدر تجرب التطبيق على المحاكي، وحتى على جوالك الشخصي، بحساب Apple العادي وبدون اشتراك. الاشتراك تحتاجه بس لـ TestFlight والنشر.

## الخطوات (أول مرة)
```bash
git clone https://github.com/37azezazez-web/masira-game.git
cd masira-game
npm install
npm run ios:sync     # يجهز الملفات وينسخها لمشروع الآيفون
npm run ios:open     # يفتح المشروع في Xcode
```
في Xcode:
1. اختر **App** من القائمة اليسار، وبعدها تبويب **Signing & Capabilities**.
2. في **Team** اختر حسابك في Apple.
3. غيّر **Bundle Identifier** لو تبي. حاليًا هو `com.intiqalat.game`، ولازم يكون فريد في المتجر.
4. اختر محاكي (مثلًا iPhone 16) واضغط ▶️.

## بعد أي تعديل في اللعبة
```bash
npm run ios:sync
```
وبعدها ▶️ في Xcode.

## النشر (لما نكون جاهزين)
1. في Xcode: **Product ← Archive**، وبعدها **Distribute App ← App Store Connect**.
2. في [App Store Connect](https://appstoreconnect.apple.com) سوّ صفحة التطبيق: الاسم، الوصف، لقطات الشاشة، سياسة الخصوصية، التصنيف العمري.
3. جرّبه مع أصحابك عبر **TestFlight** قبل ما ترسله للمراجعة.

## إعدادات جاهزة
- الاتجاه عمودي فقط على الآيفون.
- `ITSAppUsesNonExemptEncryption = false` (التطبيق ما يستخدم تشفير خاص، فتتجاوز سؤال التصدير).
- الخطوط مضمّنة داخل التطبيق، فاللعبة تشتغل بدون إنترنت بالكامل.
