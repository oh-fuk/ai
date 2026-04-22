
import { type LucideIcon } from 'lucide-react';
import { CardDescription, CardTitle } from '@/components/ui/card';

interface ChartToolbarProps {
    icon: LucideIcon;
    title: string;
    description?: string;
}

export function ChartToolbar({ icon: Icon, title, description }: ChartToolbarProps) {
    return (
        <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
            </div>
            <div className="grid gap-0.5">
                <CardTitle>{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </div>
        </div>
    );
}
