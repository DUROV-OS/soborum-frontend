import { InputHTMLAttributes, useId } from 'react'
import { Input } from '@/shared/ui/Field'

/** Поле со свободным текстом и подсказками из ранее введённых значений
 * («куда», «кто получил» в отпуске со склада, 0088-d). */
export function SuggestInput({
  suggestions,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { suggestions: string[] }) {
  const listId = useId()
  return (
    <>
      <Input {...props} list={listId} />
      <datalist id={listId}>
        {suggestions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
    </>
  )
}
