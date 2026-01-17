"use client"

import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

interface LogoProps {
  width?: number
  height?: number
  className?: string
  linkTo?: string
}

export function Logo({ width = 140, height = 42, className, linkTo }: LogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Evitar hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Mostrar logo light por defecto durante SSR/hydration
  const logoSrc = mounted && resolvedTheme === "dark"
    ? "/logo-biorem-dark.svg"
    : "/logo-biorem-light.svg"

  const image = (
    <Image
      src={logoSrc}
      alt="Biorem"
      width={width}
      height={height}
      className={className}
      priority
    />
  )

  if (linkTo) {
    return (
      <Link href={linkTo} className="flex items-center">
        {image}
      </Link>
    )
  }

  return image
}
