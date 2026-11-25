"use client";

import "./owners.css";

import Link from "next/link";
import { useEffect, useState } from "react";



import {
    FaSearch,
    FaEye,
    FaTrash,
    FaBan,
    FaCheckCircle,
} from "react-icons/fa";
import Swal from "sweetalert2";
import { deleteUser, setUserStatus } from "@/services/user.service";
import { listUsers } from "@/services/user.service";

const BUTTON_COLOR = "#2563eb";


export default function HotelOwners() {

    const [owners, setOwners] = useState([]);
    const [search, setSearch] = useState("");


    useEffect(() => {
        loadOwners();
    }, []);

    const loadOwners = async () => {

        try {

            const snapshot = await listUsers({ role: "hotel_owner" });
            const data = snapshot;

            setOwners(data);

        } catch (error) {

            console.log(error);

            Swal.fire({
              icon: "error",
              title: "Error",
              text: "Failed to load hotel owners.",
              confirmButtonColor: BUTTON_COLOR,
            });

        }

    };

    const toggleStatus = async (owner) => {

        const newStatus =
            owner.status === "Active"
                ? "Blocked"
                : "Active";

        await setUserStatus(owner.id, newStatus);

        Swal.fire({
          icon: "success",
          title: "Success",
          text: `Owner ${newStatus}`,
          confirmButtonColor: BUTTON_COLOR,
        });

        loadOwners();

    };

    const removeOwner = async (id) => {

        if (!confirm("Delete this owner?"))
            return;

        await deleteUser(id);

        Swal.fire({
          icon: "success",
          title: "Success",
          text: "Owner deleted",
          confirmButtonColor: BUTTON_COLOR,
        });

        loadOwners();

    };

    const filtered = owners.filter(owner =>
        owner.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        owner.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (

        <div className="owner-page content-wrapper">


            <div className="page-header">

                <h1>Hotel Owners</h1>

                <p>
                    Manage all registered hotel owners.
                </p>

            </div>

            <div className="toolbar">

                <div className="search-box">

                    <FaSearch />

                    <input
                        type="text"
                        placeholder="Search hotel owner..."
                        value={search}
                        onChange={(e) =>
                            setSearch(e.target.value)
                        }
                    />

                </div>

            </div>

            <div className="table-wrapper">

                <table>

                    <thead>

                        <tr>

                            <th>Photo</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Location</th>
                            <th>Hotels</th>
                            <th>Status</th>
                            <th>Actions</th>

                        </tr>

                    </thead>

                    <tbody>

                        {filtered.length === 0 ? (

                            <tr>

                                <td colSpan="8">

                                    No hotel owners found.

                                </td>

                            </tr>

                        ) : (

                            filtered.map(owner => (

                                <tr key={owner.id}>

                                    <td>

                                        <img
                                            src={
                                                owner.profileImage ||
                                                "/images/avatar.png"
                                            }
                                            alt=""
                                            className="avatar"
                                        />

                                    </td>

                                    <td>{owner.fullName}</td>

                                    <td>{owner.email}</td>

                                    <td>{owner.phone}</td>

                                    <td>
                                        {owner.city}, {owner.state}
                                    </td>

                                    <td>
                                        {owner.hotelsCount || 0}
                                    </td>

                                    <td>

                                        <span
                                            className={
                                                owner.status === "Active"
                                                    ? "active"
                                                    : "blocked"
                                            }
                                        >

                                            {owner.status}

                                        </span>

                                    </td>

                                    <td>

                                        <div className="actions">

                                            <Link
                                                href={`/superadmin/users/hotelowners/${owner.id}`}
                                                className="view"
                                            >
                                                <FaEye />
                                            </Link>

                                            <button
                                                className="status"
                                                onClick={() =>
                                                    toggleStatus(owner)
                                                }
                                            >

                                                {owner.status === "Active"
                                                    ? <FaBan />
                                                    : <FaCheckCircle />
                                                }

                                            </button>

                                            <button
                                                className="delete"
                                                onClick={() =>
                                                    removeOwner(owner.id)
                                                }
                                            >
                                                <FaTrash />
                                            </button>

                                        </div>

                                    </td>

                                </tr>

                            ))

                        )}

                    </tbody>

                </table>

            </div>

        </div>

    );

}