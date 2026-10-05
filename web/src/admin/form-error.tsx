import { useEffect, useRef } from 'react'
/** Focus a submission error once; background query refreshes do not use this. */
export function FormError({ message, id }: { message: string; id?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [message])
  return (
    <p id={id} role="alert" tabIndex={-1} ref={ref}>
      {message}
    </p>
  )
}
