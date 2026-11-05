import React from "react";
import { useParams, Link, useLocation } from "wouter";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { PdfViewer } from "@/components/builder/PdfViewer";
import { ProjectEditor } from "@/components/builder/ProjectEditor";
import { LayoutDashboard, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Builder() {
  const params = useParams();
  const [_, setLocation] = useLocation();
  const projectId = params.projectId ? parseInt(params.projectId, 10) : 0;

  if (!projectId) {
    return <div dir="rtl" className="p-8">معرّف المشروع غير صحيح</div>;
  }

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-background" dir="rtl">
      <div className="h-12 border-b flex items-center px-4 shrink-0 bg-sidebar text-sidebar-foreground gap-3">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent gap-1.5">
            <LayoutDashboard className="w-4 h-4" />
            لوحة التحكم
          </Button>
        </Link>
        <div className="text-sm font-medium text-sidebar-foreground/60">|</div>
        <div className="text-sm font-medium">بيئة العمل</div>

        <div className="mr-auto">
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent gap-1.5"
            onClick={() => setLocation(`/page-designer?projectId=${projectId}`)}
          >
            <PenTool className="w-4 h-4" />
            تصميم الصفحة
          </Button>
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* Right: PDF Viewer with training/detection */}
        <ResizablePanel defaultSize="48%" minSize="20%" maxSize="80%">
          <PdfViewer projectId={projectId} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Left: Project editor / output canvas */}
        <ResizablePanel defaultSize="52%" minSize="20%">
          <ProjectEditor projectId={projectId} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
