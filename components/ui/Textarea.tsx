type TextareaProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

export default function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
}: TextareaProps) {
  return (
    <div className="space-y-2">

      <label className="block text-sm font-bold text-black">
        {label}
      </label>

      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full
          rounded-lg
          border
          border-gray-300
          bg-white
          px-4
          py-3
          text-black
          placeholder:text-gray-500
          outline-none
          transition
          focus:border-blue-700
          focus:ring-2
          focus:ring-blue-200
        "
      />

    </div>
  )
}
