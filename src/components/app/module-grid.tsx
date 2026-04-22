'use client';

import { ArrowRight, Loader } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PageHeader from "@/components/app/page-header";

export interface ModuleItem {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    href: string;
}

interface ModuleGridProps {
    title: string;
    description: string;
    badge?: string;
    items: ModuleItem[];
}

const glassStyle: React.CSSProperties = {
    background: 'rgba(var(--card-rgb, 255,255,255), 0.07)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(255,255,255,0.13)',
};

const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } },
};

export default function ModuleGrid({ title, description, badge, items }: ModuleGridProps) {
    const router = useRouter();
    const [loading, setLoading] = useState<string | null>(null);

    return (
        <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
            <PageHeader title={title} description={description} badge={badge} />

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            >
                {items.map((item) => {
                    const isItemLoading = loading === item.href;
                    return (
                        <motion.div key={item.href} variants={itemVariants}>
                            <div
                                onClick={() => { setLoading(item.href); router.push(item.href); }}
                                className="group cursor-pointer rounded-2xl p-5 flex flex-col gap-4 h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                                style={glassStyle}
                            >
                                {/* Icon row */}
                                <div className="flex items-center justify-between">
                                    <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors duration-200">
                                        <item.icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all duration-200" />
                                </div>

                                {/* Text */}
                                <div className="flex flex-col gap-1 flex-1">
                                    <h3 className="font-semibold text-foreground text-[15px] font-headline leading-snug">
                                        {item.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {item.description}
                                    </p>
                                </div>

                                {/* CTA */}
                                <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
                                    {isItemLoading ? (
                                        <><Loader className="h-3.5 w-3.5 animate-spin" /> Opening...</>
                                    ) : (
                                        <>Open {item.title}</>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>
        </div>
    );
}
