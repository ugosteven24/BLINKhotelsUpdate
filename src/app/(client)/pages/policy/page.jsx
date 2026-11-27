
import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  LockKeyhole,
  UserRound,
  Database,
  Cookie,
  Share2,
  Clock,
  Eye,
  Mail,
  Headset,
  FileText,
  ArrowRight,
  Globe,
} from "lucide-react";

import "./privacy.css";

const sections = [
  {
    id: "information",
    icon: <Database size={21} />,
    title: "1. Information We Collect",
    content: (
      <>
        <p>
          When you use HotelReserve, we may collect information
          necessary to provide our accommodation discovery and
          reservation services.
        </p>

        <h3>Personal and account information</h3>
        <ul>
          <li>Full name and contact information.</li>
          <li>Email address and phone number.</li>
          <li>Account login and authentication information.</li>
          <li>Profile information and profile photographs, where provided.</li>
        </ul>

        <h3>Booking information</h3>
        <ul>
          <li>Hotel and room selections.</li>
          <li>Check-in and check-out dates.</li>
          <li>Number of guests and guest details.</li>
          <li>Booking references, reservation status and special requests.</li>
          <li>Payment status and transaction references, where applicable.</li>
        </ul>

        <h3>Hotel-owner information</h3>
        <p>
          If you register or manage a hotel on our platform, we may
          collect your business contact details, hotel information,
          property descriptions, images, room information and other
          information required to manage your listing.
        </p>

        <h3>Technical information</h3>
        <p>
          We may collect technical information such as your IP address,
          browser type, device information, session identifiers and
          activity necessary to operate, secure and troubleshoot the
          platform.
        </p>
      </>
    ),
  },
  {
    id: "use",
    icon: <Eye size={21} />,
    title: "2. How We Use Your Information",
    content: (
      <>
        <p>We use collected information for purposes including:</p>
        <ul>
          <li>Creating and managing customer accounts.</li>
          <li>Processing and managing hotel reservations.</li>
          <li>Communicating booking updates and important notifications.</li>
          <li>Verifying booking and payment information.</li>
          <li>Connecting guests with relevant hotel-management services.</li>
          <li>Providing customer support and responding to enquiries.</li>
          <li>Maintaining platform security and preventing fraudulent activity.</li>
          <li>Improving our website, services and user experience.</li>
          <li>Meeting applicable legal and regulatory obligations.</li>
        </ul>
      </>
    ),
  },
  {
    id: "lawful-basis",
    icon: <FileText size={21} />,
    title: "3. Legal Basis for Processing",
    content: (
      <>
        <p>
          We process personal information only where an applicable
          lawful basis permits us to do so. Depending on the activity,
          this may include:
        </p>
        <ul>
          <li>
            <strong>Contract:</strong> To create your account, process
            reservations and provide services you request.
          </li>
          <li>
            <strong>Legal obligation:</strong> To comply with applicable
            laws, regulations and lawful requests.
          </li>
          <li>
            <strong>Legitimate interests:</strong> To protect our platform,
            prevent misuse, maintain services and improve operations,
            where those interests do not override your rights.
          </li>
          <li>
            <strong>Consent:</strong> Where consent is required, such as
            for certain optional communications or data uses. You may
            withdraw consent where processing relies on it.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "sharing",
    icon: <Share2 size={21} />,
    title: "4. How We Share Your Information",
    content: (
      <>
        <p>
          We do not make your personal information publicly available
          simply because you use HotelReserve. However, certain
          information may be shared where necessary to provide our
          services.
        </p>
        <ul>
          <li>
            <strong>Hotels and accommodation providers:</strong> Relevant
            guest and reservation details may be shared with the hotel
            handling your booking.
          </li>
          <li>
            <strong>Payment providers:</strong> Relevant transaction
            information may be processed by payment providers when
            payments are supported through the platform.
          </li>
          <li>
            <strong>Technology and hosting providers:</strong> Service
            providers may process information to host, maintain, secure
            and operate the platform.
          </li>
          <li>
            <strong>Legal and regulatory authorities:</strong> Information
            may be disclosed where required by applicable law or a valid
            legal process.
          </li>
        </ul>
        <p>
          We expect service providers who process personal information
          on our behalf to handle it under appropriate contractual and
          security safeguards.
        </p>
      </>
    ),
  },
  {
    id: "security",
    icon: <LockKeyhole size={21} />,
    title: "5. How We Protect Your Information",
    content: (
      <>
        <p>
          We use appropriate technical and organisational measures
          intended to protect personal information against
          unauthorised access, alteration, disclosure, loss or misuse.
        </p>
        <p>These measures may include:</p>
        <ul>
          <li>Access controls and account authentication.</li>
          <li>Secure handling of login credentials.</li>
          <li>Database access restrictions.</li>
          <li>Session management and security monitoring.</li>
          <li>Appropriate safeguards when working with service providers.</li>
        </ul>
        <p>
          No website, database or internet transmission can be
          guaranteed to be completely secure. We therefore cannot
          promise absolute security.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    icon: <Cookie size={21} />,
    title: "6. Cookies and Similar Technologies",
    content: (
      <>
        <p>
          HotelReserve may use cookies or similar technologies to
          support essential website functions, maintain user sessions,
          remember preferences and improve the platform.
        </p>
        <p>
          Essential technologies may be necessary for account
          authentication, security and the operation of certain
          features.
        </p>
        <p>
          If optional analytics or advertising technologies are used,
          we will provide appropriate information and obtain consent
          where required by law.
        </p>
        <p>
          You can manage cookies through your browser settings.
          Blocking certain cookies may affect how parts of the
          platform function.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    icon: <Clock size={21} />,
    title: "7. How Long We Keep Your Information",
    content: (
      <>
        <p>
          We retain personal information only for as long as reasonably
          necessary to fulfil the purposes for which it was collected,
          including providing our services, maintaining records,
          resolving disputes and meeting legal obligations.
        </p>
        <p>
          Retention periods may vary depending on the type of
          information, the nature of the booking, account activity
          and applicable legal requirements.
        </p>
        <p>
          When information is no longer required, we will take
          appropriate steps to delete it or anonymise it, subject
          to applicable legal obligations and legitimate retention
          requirements.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    icon: <UserRound size={21} />,
    title: "8. Your Privacy Rights",
    content: (
      <>
        <p>
          Subject to applicable law and any relevant limitations,
          you may have the right to:
        </p>
        <ul>
          <li>Request access to your personal information.</li>
          <li>Request correction of inaccurate or incomplete information.</li>
          <li>Request deletion of personal information in eligible circumstances.</li>
          <li>Request restriction of certain processing activities.</li>
          <li>Object to certain types of processing.</li>
          <li>Request a copy of information you provided in a portable format, where applicable.</li>
          <li>Withdraw consent where processing is based on your consent.</li>
          <li>Complain to the relevant data protection authority.</li>
        </ul>
        <p>
          To exercise these rights, contact us using the details
          provided below. We may need to verify your identity before
          responding to a request.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    icon: <Globe size={21} />,
    title: "9. International Data Transfers",
    content: (
      <>
        <p>
          Some of our hosting, technology or service providers may
          process information in countries outside Nigeria.
        </p>
        <p>
          Where personal information is transferred internationally,
          we will take steps required by applicable data protection
          law to ensure that appropriate safeguards are in place.
        </p>
      </>
    ),
  },
  {
    id: "children",
    icon: <ShieldCheck size={21} />,
    title: "10. Children's Privacy",
    content: (
      <>
        <p>
          HotelReserve is not intended to be used independently by
          children to create customer accounts or make reservations.
          We do not knowingly collect children's personal information
          without an appropriate lawful basis and safeguards.
        </p>
        <p>
          If you believe a child has provided personal information
          improperly, please contact us so we can review the matter.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    icon: <FileText size={21} />,
    title: "11. Changes to This Privacy Policy",
    content: (
      <p>
        We may update this Privacy Policy when our services, data
        practices or legal requirements change. Updated versions
        will be published on this page with a revised update date.
        We encourage you to review this page periodically.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="privacy-page">

      {/* Hero */}
      <section className="privacy-hero">
        <div className="privacy-hero-content">
          <span className="privacy-eyebrow">
            HOTELRESERVE PRIVACY
          </span>

          <h1>
            Your privacy.
            <span> Our responsibility.</span>
          </h1>

          <p>
            We respect your privacy and are committed to handling
            your personal information responsibly whenever you
            use HotelReserve.
          </p>

          <div className="privacy-hero-meta">
            <ShieldCheck size={19} />
            <span>Privacy and data protection information</span>
          </div>
        </div>

        <div className="privacy-hero-icon">
          <LockKeyhole size={105} strokeWidth={1.2} />
        </div>
      </section>

      {/* Introduction */}
      <section className="privacy-intro">
        <span className="privacy-section-label">
          YOUR INFORMATION MATTERS
        </span>

        <h2>How we handle your personal information</h2>

        <p>
          This Privacy Policy explains what information we collect,
          why we collect it, how we use and share it, and the choices
          and rights available to you when using HotelReserve.
        </p>

        <div className="privacy-updated">
          <Clock size={17} />
          <span>Last updated: 27 November 2026</span>
        </div>
      </section>

      {/* Policy Sections */}
      <section className="privacy-layout">
        <aside className="privacy-sidebar">
          <h3>On this page</h3>

          <nav>
            {sections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>
                {section.title}
              </a>
            ))}
            <a href="#contact">12. Contact Us</a>
          </nav>
        </aside>

        <div className="privacy-sections">
          {sections.map((section) => (
            <section
              className="privacy-section"
              id={section.id}
              key={section.id}
            >
              <div className="privacy-section-heading">
                <div className="privacy-section-icon">
                  {section.icon}
                </div>

                <h2>{section.title}</h2>
              </div>

              <div className="privacy-section-body">
                {section.content}
              </div>
            </section>
          ))}

          {/* Contact */}
          <section className="privacy-section" id="contact">
            <div className="privacy-section-heading">
              <div className="privacy-section-icon">
                <Mail size={21} />
              </div>

              <h2>12. Contact Us</h2>
            </div>

            <div className="privacy-section-body">
              <p>
                If you have questions about this Privacy Policy,
                wish to exercise your privacy rights, or have a
                concern about how your personal information is
                handled, please contact our team.
              </p>

              <div className="privacy-contact-card">
                <Mail size={22} />
                <div>
                  <strong>Privacy enquiries</strong>
                  <a href="mailto:YOUR-PRIVACY-EMAIL@example.com">
                    YOUR-PRIVACY-EMAIL@example.com
                  </a>
                </div>
              </div>

              <p>
                You also have the right to lodge a complaint with
                the Nigeria Data Protection Commission (NDPC), where
                applicable.
              </p>

              <a
                className="privacy-external-link"
                href="https://ndpc.gov.ng/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit the Nigeria Data Protection Commission
                <ArrowRight size={17} />
              </a>
            </div>
          </section>
        </div>
      </section>

      {/* CTA */}
      <section className="privacy-cta">
        <div className="privacy-cta-icon">
          <Headset size={29} />
        </div>

        <h2>Have a privacy question?</h2>

        <p>
          If you need clarification about your information or
          how HotelReserve handles your data, our team is here
          to help.
        </p>

        <Link href="/pages/contact">
          Contact Our Team <ArrowRight size={18} />
        </Link>
      </section>

      {/* Footer promises */}
      <section className="privacy-promises">
        <div>
          <ShieldCheck size={27} />
          <span>
            <strong>Responsible Data Handling</strong>
            <small>Your information deserves care</small>
          </span>
        </div>

        <div>
          <LockKeyhole size={27} />
          <span>
            <strong>Account Security</strong>
            <small>We work to protect your account</small>
          </span>
        </div>

        <div>
          <UserRound size={27} />
          <span>
            <strong>Your Privacy Rights</strong>
            <small>Your information, your rights</small>
          </span>
        </div>
      </section>

    </main>
  );
}
