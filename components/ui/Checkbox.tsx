type CheckboxProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

export default function Checkbox({
  checked,
  onChange,
  label,
}: CheckboxProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">

      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="
          h-5
          w-5
          rounded
          border-gray-300
          accent-blue-700
        "
      />

      <span className="text-black">
        {label}
      </span>

    </label>
  )
}