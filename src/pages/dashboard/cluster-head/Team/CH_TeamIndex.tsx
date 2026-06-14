import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "@/components/dashboard/StatCard";
import { viewOrganization } from "@/services/organization.service";
import { listTechnicians } from "@/services/technician.service";
import { listDoctors } from "@/services/doctor.service";
import { User2, HeartPulse, Wrench, Stethoscope } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const CH_TeamIndex = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ userHeads: 0, nurses: 0, technicians: 0, doctors: 0 });
  const [userHeads, setUserHeads] = useState<any[]>([]);
  const [nurses, setNurses] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const orgId = localStorage.getItem("organizationId");
      const data = await viewOrganization(orgId || "");
      const org = data.organization || data;

      const techData = await listTechnicians();
      const allDoctors = await listDoctors();
      const filteredDoctors = allDoctors.filter(
        (doc: any) => doc.orgId === orgId || doc.organization?._id === orgId || doc.organization?.id === orgId
      );

      setStats({
        userHeads: org.userHead?.length || 0,
        nurses: org.nurse?.length || 0,
        technicians: techData?.length || 0,
        doctors: filteredDoctors.length,
      });
      setUserHeads(org.userHead || []);
      setNurses(org.nurse || []);
      setTechnicians(techData || []);
      setDoctors(filteredDoctors);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error fetching team data",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getDoctorStatusClass = (status?: string) => {
    switch (status) {
      case "Inactive":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "Pending Verification":
        return "bg-amber-50 text-amber-600 border-amber-200";
      case "Suspended":
        return "bg-rose-50 text-rose-600 border-rose-200";
      case "Active":
      default:
        return "bg-[#e6f4ea] text-[#137333] border-[#ceead6]";
    }
  };

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-10">
        Loading team overview...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Team Overview</h1>
        <p className="text-muted-foreground mt-1">
          Quick view of your organization’s team members
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="User Heads"
          value={stats.userHeads.toString()}
          icon={User2}
          variant="primary"
          trend={{ value: "Active", isPositive: true }}
        />
        <StatCard
          title="Nurses"
          value={stats.nurses.toString()}
          icon={HeartPulse}
          variant="secondary"
          trend={{ value: "Active", isPositive: true }}
        />
        <StatCard
          title="Technicians"
          value={stats.technicians.toString()}
          icon={Wrench}
          variant="warning"
          trend={{ value: "Active", isPositive: true }}
        />
        <StatCard
          title="Doctors"
          value={stats.doctors.toString()}
          icon={Stethoscope}
          variant="success"
          trend={{ value: "Active", isPositive: true }}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* User Heads Table */}
        <div className="bg-card rounded-lg shadow-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">User Heads</h3>
            <button
              onClick={() => navigate("/dashboard/cluster-head/team/user-heads")}
              className="text-sm text-primary hover:underline"
            >
              View All →
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold">Name</th>
                <th className="text-left py-3 px-4 font-semibold">Phone</th>
                <th className="text-left py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {userHeads.slice(0, 3).map((u, i) => (
                <tr
                  key={u._id || u.id || u.name || i}
                  className="border-b hover:bg-muted/50 transition-colors"
                >
                  <td className="py-3 px-4 font-medium">{u.name}</td>
                  <td className="py-3 px-4">+{u.phone_number?.join(" ")}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        u.status === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
              {userHeads.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center text-muted-foreground py-4"
                  >
                    No user heads found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Nurses Table */}
        <div className="bg-card rounded-lg shadow-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Nurses</h3>
            <button
              onClick={() => navigate("/dashboard/cluster-head/team/nurses")}
              className="text-sm text-primary hover:underline"
            >
              View All →
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold">Name</th>
                <th className="text-left py-3 px-4 font-semibold">Phone</th>
                <th className="text-left py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {nurses.slice(0, 3).map((n, i) => (
                <tr
                  key={n._id || n.id || n.name || i}
                  className="border-b hover:bg-muted/50 transition-colors"
                >
                  <td className="py-3 px-4 font-medium">{n.name}</td>
                  <td className="py-3 px-4">+{n.phone_number?.join(" ")}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        n.status === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {n.status}
                    </span>
                  </td>
                </tr>
              ))}
              {nurses.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center text-muted-foreground py-4"
                  >
                    No nurses found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Technicians Table */}
        <div className="bg-card rounded-lg shadow-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Technicians</h3>
            <button
              onClick={() => navigate("/dashboard/cluster-head/team/technicians")}
              className="text-sm text-primary hover:underline"
            >
              View All →
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold">Name</th>
                <th className="text-left py-3 px-4 font-semibold">Phone</th>
                <th className="text-left py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {technicians.slice(0, 3).map((t, i) => (
                <tr
                  key={t._id || t.id || t.name || i}
                  className="border-b hover:bg-muted/50 transition-colors"
                >
                  <td className="py-3 px-4 font-medium">{t.name}</td>
                  <td className="py-3 px-4">+{t.phone_number?.join(" ")}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        t.status === "Active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
              {technicians.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center text-muted-foreground py-4"
                  >
                    No technicians found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Doctors Table */}
        <div className="bg-card rounded-lg shadow-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Doctors</h3>
            <button
              onClick={() => navigate("/dashboard/cluster-head/team/doctors")}
              className="text-sm text-primary hover:underline"
            >
              View All →
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold">Name</th>
                <th className="text-left py-3 px-4 font-semibold">Specialty</th>
                <th className="text-left py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {doctors.slice(0, 3).map((d, i) => (
                <tr
                  key={d._id || d.id || d.name || i}
                  className="border-b hover:bg-muted/50 transition-colors"
                >
                  <td className="py-3 px-4 font-medium">{d.name}</td>
                  <td className="py-3 px-4">{d.specialization || d.specialty || "—"}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${getDoctorStatusClass(
                        d.status
                      )}`}
                    >
                      {d.status || "Active"}
                    </span>
                  </td>
                </tr>
              ))}
              {doctors.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center text-muted-foreground py-4"
                  >
                    No doctors found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CH_TeamIndex;
