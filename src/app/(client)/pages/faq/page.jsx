import React from "react";
import Link from "next/link";
import {
  ChevronDown,
  HelpCircle,
  Headset,
  ShieldCheck,
  Hotel,
  CreditCard,
  CalendarCheck,
  User,
  Search,
  MessageCircle,
  ArrowRight,
} from "lucide-react";

import "./faq.css";

const faqCategories = [
  {
    title: "General Questions",
    icon: <HelpCircle size={21} />,
    questions: [
      {
        question: "What is HotelReserve?",
        answer:
          "HotelReserve is an online hotel and resort booking platform that helps travellers discover accommodation, explore hotel facilities, compare available options, and manage their reservations conveniently.",
      },
      {
        question: "How does HotelReserve work?",
        answer:
          "You can browse hotels and resorts, view their descriptions, facilities, room categories, and prices. When you find suitable accommodation, select your preferred dates and room option, provide your guest information, and submit your reservation.",
      },
      {
        question: "Do I need an account to book a hotel?",
        answer:
          "You may browse available accommodation without an account. However, you need to sign in or create an account to make and manage reservations through your customer dashboard.",
      },
      {
        question: "Can I browse hotels in different cities?",
        answer:
          "Yes. You can explore accommodation in different destinations and search for hotels based on your preferred city or location.",
      },
    ],
  },

  {
    title: "Bookings and Reservations",
    icon: <CalendarCheck size={21} />,
    questions: [
      {
        question: "How do I make a hotel reservation?",
        answer:
          "Browse the available hotels, select the hotel you want, choose your preferred room category and travel dates, enter your guest details, and submit your booking request. Follow the instructions displayed during the reservation process.",
      },
      {
        question: "How do I know if my booking is confirmed?",
        answer:
          "You can check your reservation status from the My Bookings section of your dashboard. A submitted booking may remain pending while the hotel management reviews and approves it. Look out for notifications about changes to your booking status.",
      },
      {
        question: "Can I modify my reservation after booking?",
        answer:
          "Changes to an existing reservation may depend on the hotel's policies and the current booking status. Contact our support team for assistance with modification requests.",
      },
      {
        question: "Where can I find my booking details?",
        answer:
          "Sign in to your HotelReserve account and visit the My Bookings section. You can review your reservation information and check its current status there.",
      },
      {
        question: "Can I book accommodation for another person?",
        answer:
          "Yes. When making a reservation, provide the correct guest information for the person who will be staying at the hotel.",
      },
    ],
  },

  {
    title: "Payments and Refunds",
    icon: <CreditCard size={21} />,
    questions: [
      {
        question: "How can I pay for my reservation?",
        answer:
          "Available payment methods will be displayed during the booking process. Follow the payment instructions provided on the platform.",
      },
      {
        question: "How do I know if my payment was successful?",
        answer:
          "Check your booking details and payment status in your customer dashboard. You may also receive a notification when your payment is successfully verified.",
      },
      {
        question: "What happens if my payment is unsuccessful?",
        answer:
          "If a payment fails, check your payment details and contact your payment provider if necessary. You can also contact HotelReserve support for assistance. Avoid making repeated payments until you have checked whether the previous transaction was successful.",
      },
      {
        question: "How do I request a refund?",
        answer:
          "Refund eligibility depends on the applicable booking and cancellation conditions. Contact our support team with your booking reference and details of your refund request.",
      },
    ],
  },

  {
    title: "Hotels and Accommodation",
    icon: <Hotel size={21} />,
    questions: [
      {
        question: "How can I find the right hotel?",
        answer:
          "Explore hotels by destination and review their descriptions, room categories, available facilities, prices, and other information before making your decision.",
      },
      {
        question: "Are hotel facilities and amenities displayed?",
        answer:
          "Hotel listings may include information about available facilities and amenities. We recommend reviewing each hotel's listing carefully before making a reservation.",
      },
      {
        question: "Can I register my hotel on HotelReserve?",
        answer:
          "Hotel owners interested in listing their properties on HotelReserve can contact our team to learn about the registration and approval process.",
      },
      {
        question: "How can I contact a hotel?",
        answer:
          "You can review the contact information provided on the hotel's listing. You may also contact HotelReserve support if you need assistance.",
      },
    ],
  },

  {
    title: "Account and Security",
    icon: <User size={21} />,
    questions: [
      {
        question: "How do I create a HotelReserve account?",
        answer:
          "Visit the registration page, provide the requested information, and follow the instructions to create your account.",
      },
      {
        question: "I forgot my password. What should I do?",
        answer:
          "Use the password recovery option on the sign-in page, if available, and follow the instructions to reset your password.",
      },
      {
        question: "Is my personal information secure?",
        answer:
          "HotelReserve aims to protect customer information through appropriate security measures. You should also keep your password private and avoid sharing your account credentials with anyone.",
      },
      {
        question: "Can I update my account information?",
        answer:
          "You can manage the personal information available in your account profile through your customer dashboard.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <main className="faq-page">

      {/* Hero */}
      <section className="faq-hero">
        <div className="faq-hero-content">
          <span className="faq-eyebrow">
            HOTELRESERVE SUPPORT
          </span>

          <h1>
            Frequently Asked
            <span> Questions</span>
          </h1>

          <p>
            Have questions about finding hotels, making reservations,
            payments, or managing your account? Find helpful answers
            to common questions below.
          </p>

          <div className="faq-hero-actions">
            <Link href="/pages/resorts" className="faq-primary-btn">
              Explore Hotels <ArrowRight size={18} />
            </Link>

            <Link href="/pages/contact" className="faq-outline-btn">
              Contact Support
            </Link>
          </div>
        </div>

        <div className="faq-hero-icon">
          <HelpCircle size={100} strokeWidth={1.2} />
        </div>
      </section>

      {/* Introduction */}
      <section className="faq-intro">
        <span className="faq-section-label">
          HELP CENTER
        </span>

        <h2>How can we help you?</h2>

        <p>
          We've put together answers to questions travellers
          commonly ask about using HotelReserve. Browse the
          categories below to find the information you need.
        </p>
      </section>

      {/* FAQ Categories */}
      <section className="faq-content">
        {faqCategories.map((category, index) => (
          <div className="faq-category" key={index}>

            <div className="faq-category-heading">
              <div className="faq-category-icon">
                {category.icon}
              </div>

              <h2>{category.title}</h2>
            </div>

            <div className="faq-list">
              {category.questions.map((item, questionIndex) => (
                <details
                  className="faq-item"
                  key={questionIndex}
                >
                  <summary>
                    <span>{item.question}</span>
                    <ChevronDown size={20} />
                  </summary>

                  <div className="faq-answer">
                    <p>{item.answer}</p>
                  </div>
                </details>
              ))}
            </div>

          </div>
        ))}
      </section>

      {/* Contact Support */}
      <section className="faq-cta">
        <div className="faq-cta-icon">
          <MessageCircle size={30} />
        </div>

        <h2>Still have questions?</h2>

        <p>
          Couldn't find the answer you were looking for?
          Our support team is available to help you with
          your questions and reservation concerns.
        </p>

        <Link href="/pages/contact">
          Contact Our Support Team <ArrowRight size={18} />
        </Link>
      </section>

      {/* Promises */}
      <section className="faq-promises">
        <div>
          <ShieldCheck size={27} />
          <span>
            <strong>Secure Booking</strong>
            <small>Your information matters to us</small>
          </span>
        </div>

        <div>
          <Headset size={27} />
          <span>
            <strong>Customer Support</strong>
            <small>We're here to help</small>
          </span>
        </div>

        <div>
          <Hotel size={27} />
          <span>
            <strong>Find Your Stay</strong>
            <small>Discover accommodation options</small>
          </span>
        </div>
      </section>

    </main>
  );
}