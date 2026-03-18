import { motion } from "framer-motion";

const fadeUp = {
    hidden: { opacity: 0, y: 32 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

export default function SectionBadge({ label }: { label: string }) {
    return (
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="flex justify-center mb-4">
            <span className="inline-flex items-center rounded-full border bg-secondary px-4 py-1.5 text-sm font-medium text-muted-foreground">
                {label}
            </span>
        </motion.div>
    );
}