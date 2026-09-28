import { toast as sonnerToast } from "sonner"

export function useToast() {
  return {
    toast: (props: { title?: string, description?: React.ReactNode, variant?: string }) => {
      if (props.variant === "destructive") {
        sonnerToast.error(props.title, { description: props.description })
      } else {
        sonnerToast.success(props.title, { description: props.description })
      }
    }
  }
}
