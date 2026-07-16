type PageHeaderProps = {
  title: string
  subtitle?: string
}

export default function PageHeader({
  title,
  subtitle,
}: PageHeaderProps) {
  return (
    <div className="mb-6 sm:mb-8 lg:mb-10">

      <h1 className="break-words text-2xl font-bold leading-tight text-black sm:text-3xl lg:text-4xl">
        {title}
      </h1>

      {subtitle && (
        <p className="mt-2 text-base leading-6 text-gray-700 sm:text-lg sm:text-black">
          {subtitle}
        </p>
      )}

    </div>
  )
}
