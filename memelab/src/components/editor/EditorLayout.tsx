"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PanelRightClose, PanelRightOpen, Monitor } from "lucide-react";

interface EditorLayoutProps {
  toolbar: React.ReactNode;
  preview: React.ReactNode;
  timeline?: React.ReactNode;
  panel?: React.ReactNode;
}

export function EditorLayout({ toolbar, preview, timeline, panel }: EditorLayoutProps) {
  const [isDesktop, setIsDesktop] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!isDesktop) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-8">
        <div className="text-center space-y-4 max-w-md">
          <Monitor className="h-16 w-16 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Editor de Video</h2>
          <p className="text-muted-foreground">
            Use um computador para acessar o editor de video. A tela precisa ter pelo menos 1024px de largura.
          </p>
          <Link
            href="/reels"
            className="inline-flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300"
          >
            Voltar para Reels
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {toolbar}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-shrink-0 flex items-center justify-center p-4 bg-background">
            {preview}
          </div>

          <div className="flex-1 overflow-auto border-t border-border">
            {timeline ?? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Timeline aqui
              </div>
            )}
          </div>
        </div>

        {panelOpen && (
          <div className="w-80 border-l border-border shrink-0 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-sm font-medium">Propriedades</span>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="p-1 rounded hover:bg-accent text-muted-foreground"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            </div>
            {panel ?? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                Selecione uma cena
              </div>
            )}
          </div>
        )}

        {!panelOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="p-2 border-l border-border hover:bg-accent text-muted-foreground self-start mt-2"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
