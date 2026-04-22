'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TermsOfServiceProps {
    isOpen: boolean;
    onClose: () => void;
}

export function TermsOfServiceModal({ isOpen, onClose }: TermsOfServiceProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-h-[80vh] overflow-y-auto max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Terms of Service</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 text-sm leading-relaxed">
                    <section>
                        <h3 className="font-semibold text-base mb-2">1. Agreement to Terms</h3>
                        <p>
                            By accessing and using the AthenaAI platform (the "Service"), you accept and agree to be
                            bound by and comply with the terms and provision of this agreement. If you do not agree to
                            abide by the above, please do not use this service.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">2. License</h3>
                        <p>
                            AthenaAI grants you a limited, non-exclusive, non-transferable license to use the Service
                            for educational purposes only. You agree not to reproduce, duplicate, copy, sell, resell,
                            or exploit any portion of the Service without explicit written permission from AthenaAI.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">3. User Responsibilities</h3>
                        <p>
                            As a user of AthenaAI, you agree to:
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Use the Service only for lawful purposes</li>
                            <li>Not engage in any conduct that restricts others' use or enjoyment of the Service</li>
                            <li>Not attempt to gain unauthorized access to the Service</li>
                            <li>Not upload or transmit viruses or any other malicious code</li>
                            <li>Maintain the confidentiality of your account information</li>
                            <li>Not use the Service for academic dishonesty or cheating</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">4. Intellectual Property Rights</h3>
                        <p>
                            The Service and its entire contents, features, and functionality (including but not limited to
                            all information, software, text, displays, images, video, and audio) are owned by AthenaAI,
                            its licensors, or other providers of such material and are protected by copyright, trademark,
                            and other intellectual property laws.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">5. Limitations of Liability</h3>
                        <p>
                            In no event shall AthenaAI or its suppliers be liable for any damages (including, without
                            limitation, damages for loss of data or profit, or due to business interruption) arising out
                            of the use or inability to use the materials on the Service.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">6. Modification of Content</h3>
                        <p>
                            AthenaAI does not warrant that any of the materials on its Service are accurate, complete,
                            or current. AthenaAI may make changes to the materials contained on the Service at any time
                            without notice.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">7. Links to Third-Party Sites</h3>
                        <p>
                            The Service may contain links to third-party sites. AthenaAI is not responsible for the
                            contents of any linked site and does not make any representations about third-party sites
                            or any materials contained therein.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">8. Termination</h3>
                        <p>
                            AthenaAI may terminate or suspend your access to the Service at any time, with or without
                            cause, with or without notice. Upon termination, your right to use the Service will cease immediately.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">9. Disclaimer</h3>
                        <p>
                            THE MATERIALS ON ATHENAAI'S SERVICE ARE PROVIDED "AS IS". ATHENAAI MAKES NO WARRANTIES,
                            EXPRESSED OR IMPLIED, AND HEREBY DISCLAIMS AND NEGATES ALL OTHER WARRANTIES INCLUDING,
                            WITHOUT LIMITATION, IMPLIED WARRANTIES OR CONDITIONS OF MERCHANTABILITY, FITNESS FOR A
                            PARTICULAR PURPOSE, OR NON-INFRINGEMENT OF INTELLECTUAL PROPERTY OR OTHER VIOLATION OF RIGHTS.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">10. Limitations</h3>
                        <p>
                            In no event shall AthenaAI or its suppliers be liable for any damages (including, without
                            limitation, damages for loss of data or profit, or due to business interruption).
                        </p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">11. Governing Law</h3>
                        <p>
                            These Terms and Conditions are governed by and construed in accordance with the laws of
                            the jurisdiction in which AthenaAI operates, and you irrevocably submit to the exclusive
                            jurisdiction of the courts in that location.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-semibold text-base mb-2">12. Contact Information</h3>
                        <p>
                            If you have any questions about these Terms and Conditions, please contact us at:
                            <br />
                            <strong>Email:</strong> legal@athenaai.com
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
