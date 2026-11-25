"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { logout as logoutAction } from "@/services/auth.service";

import { FaSpinner } from "react-icons/fa";

import "./logout.css";

export default function LogoutPage() {

    const router = useRouter();

    useEffect(() => {

        const logout = async () => {

            try {

                await logoutAction();

                localStorage.removeItem("admin");

                sessionStorage.clear();

                router.replace("/Adminlogin");

            }

            catch (error) {

                console.log(error);

                router.replace("/login");

            }

        };

        logout();

    }, [router]);

    return (

        <div className="logout-page">

            <div className="logout-card">

                <FaSpinner className="spinner" />

                <h2>

                    Signing you out...

                </h2>

                <p>

                    Please wait while we securely log you out.

                </p>

            </div>

        </div>

    );

}