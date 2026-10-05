import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { cn } from '@/lib/utils'

export function Calendar({ className, ...props }: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker showOutsideDays weekStartsOn={1} className={cn('calendar', className)} {...props} />
  )
}
