import { cn } from "@/lib/utils"
import Image from "next/image"
import logo  from "@/LOGO/logo.png"

export const AthenaLogo = ({ className, ...props }: Omit<React.ComponentProps<typeof Image>, 'src' | 'alt'>) => (
    <Image 
        src={logo}
        alt="AthenaAI Logo" 
        width={512} 
        height={512} 
        className={cn("rounded-full", className)}
        {...props} 
    />
);
