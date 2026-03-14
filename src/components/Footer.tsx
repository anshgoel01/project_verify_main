import { Linkedin, Github, Mail } from "lucide-react";

export default function Footer() {
    return (
        <footer className="border-t bg-background">
            <div className="container py-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-foreground">VerifyHub</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Automated project verification.
                        </p>
                        <div className="flex gap-4">
                            <a
                                href="https://www.linkedin.com/in/anshuman-goel-a31756199/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="LinkedIn"
                            >
                                <Linkedin className="h-5 w-5" />
                            </a>
                            <a
                                href="https://github.com/anshgoel01/project_verify_main"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="GitHub"
                            >
                                <Github className="h-5 w-5" />
                            </a>
                            <a
                                href="mailto:verifyhubb@gmail.com"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Email"
                            >
                                <Mail className="h-5 w-5" />
                            </a>
                        </div>
                    </div>

                    <div className="text-sm text-muted-foreground flex justify-center">
                        <p>© 2026 VerifyHub. Built by Anshuman Goel.</p>
                    </div>
                </div>
            </div>
        </footer>
    );
}