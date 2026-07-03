type PageHeaderProps = {
  title: string
  subtitle?: string
}

export default function PageHeader({
  title,
  subtitle,
}: PageHeaderProps) {
  return (
    <div className="mb-10">

      <h1 className="text-4xl font-bold text-black">
        {title}
      </h1>

      {subtitle && (
        <p className="mt-2 text-lg text-black">
          {subtitle}
        </p>
      )}

    </div>
  )
}