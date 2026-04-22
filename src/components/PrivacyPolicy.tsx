'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PrivacyPolicyProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PrivacyPolicyModal({ isOpen, onClose }: PrivacyPolicyProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-h-[80vh] overflow-y-auto max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Privacy Policy</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 text-sm leading-relaxed">
                    <section>
                        <h3 className="font-semibold text-base mb-2">1. Introduction</h3>
                        <p>
                            AthenaAI ("we", "us", "our", or "Company") is committed to protecting your privacy.
                            This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                            when you use our educational platform.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">2. Information We Collect</h3>
                        <p>
                            We may collect information about you in a variety of ways. The information we may collect
                            on the Site includes:
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><strong>Personal Data:</strong> Email address, name, password, and academic information</li>
                            <li><strong>Academic Data:</strong> Quiz scores, papers, study plans, and learning history</li>
                            <li><strong>Usage Data:</strong> How you interact with our service</li>
                            <li><strong>Device Data:</strong> Browser type, IP address, and device information</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">3. Use of Your Information</h3>
                        <p>
                            Having accurate information about you permits us to provide you with a smooth, efficient,
                            and customized experience. Specifically, we may use information collected about you via
                            the Site to:
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Generate and personalize your study materials</li>
                            <li>Track your academic progress</li>
                            <li>Improve our service and features</li>
                            <li>Send you educational updates and notifications</li>
                            <li>Comply with legal obligations</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">4. Disclosure of Your Information</h3>
                        <p>
                            We may share information we have collected about you in certain situations:
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>By Law or to Protect Rights</li>
                            <li>Third-Party Service Providers</li>
                            <li>Other Parties with Your Consent</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">5. Security of Your Information</h3>
                        <p>
                            We use administrative, technical, and physical security measures to help protect your
                            personal information. While we have taken reasonable steps to secure the personal
                            information you provide to us, please be aware that no security measures are perfect or impenetrable.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">6. Contact Us</h3>
                        <p>
                            If you have questions or comments about this Privacy Policy, please contact us at:
                            <br />
                            <strong>Email:</strong> privacy@athenaai.com
                        </p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">7. Changes to This Privacy Policy</h3>
                        <p>
                            AthenaAI reserves the right to make changes to this Privacy Policy at any time and for
                            any reason. We will alert you about any changes by updating the "Last Updated" date of
                            this Privacy Policy.
                        </p>
                    </section>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <Button onClick={onClose} variant="outline">
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
