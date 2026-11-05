import { Link } from 'wouter';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background" dir="rtl">
      <div className="text-center space-y-4 p-8">
        <AlertCircle className="h-16 w-16 text-muted-foreground/40 mx-auto" />
        <h1 className="text-3xl font-bold">404 — الصفحة غير موجودة</h1>
        <p className="text-muted-foreground max-w-sm mx-auto">
          الصفحة التي تبحث عنها غير موجودة أو تمت إزالتها.
        </p>
        <Link href="/">
          <Button className="mt-4">العودة للرئيسية</Button>
        </Link>
      </div>
    </div>
  );
}
