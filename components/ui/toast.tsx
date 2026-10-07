"use client";

import { Toaster as SonnerToaster } from "sonner";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

/**
 * App-wide toaster. Visual language: a dark accent pill rising from the
 * bottom-centre (see `.f-toast` in globals.css). The pill itself follows the
 * workspace accent; semantic meaning is carried by the icon colour, which is
 * independent from the accent (success green / warning amber / error red).
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      offset={24}
      mobileOffset={{ bottom: 104 }}
      gap={10}
      duration={2800}
      icons={{
        success: <CheckCircle2 className="h-4 w-4 text-[#4ADE80]" aria-hidden />,
        error: <XCircle className="h-4 w-4 text-[#FCA5A5]" aria-hidden />,
        warning: <AlertTriangle className="h-4 w-4 text-[#FCD34D]" aria-hidden />,
        info: <Info className="h-4 w-4 text-white/80" aria-hidden />,
      }}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: "f-toast",
        },
      }}
    />
  );
}

export { toast } from "sonner";
