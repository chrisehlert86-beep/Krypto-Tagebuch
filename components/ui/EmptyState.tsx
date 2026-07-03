type EmptyStateProps = {
  title: string
  description?: string
}

export default function EmptyState({
  title,
  description,
}: EmptyStateProps) {
  return (
    <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">

      <h2 className="text-2xl font-bold text-black">
        {title}
      </h2>

      {description && (
        <p className="mt-3 text-black">
          {description}
        </p>
      )}

    </div>
  )
}