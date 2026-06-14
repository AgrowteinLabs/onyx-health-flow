import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Search, Shield } from "lucide-react";
import { listExecutives, updateExecAdmin } from "@/services/executiveAdmin.service";
import { Switch } from "@/components/ui/switch";

const EA_ExecutiveAdmins = () => {
  const { toast } = useToast();
  const [executives, setExecutives] = useState<any[]>([]);
  const [filteredExecutives, setFilteredExecutives] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{ id: string; currentStatus: string } | null>(null);

  // =============================
  // Fetch all Executive Admins
  // =============================
  const fetchExecutives = async () => {
    setLoading(true);
    try {
      const data = await listExecutives();
      const list = data.executives || data;
      setExecutives(list);
      setFilteredExecutives(list);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error fetching Executive Admins",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleStatus = (id: string, currentStatus?: string) => {
    setConfirmData({ id, currentStatus: currentStatus || "Active" });
    setConfirmOpen(true);
  };

  const executeToggleStatus = async () => {
    if (!confirmData) return;
    const { id, currentStatus } = confirmData;
    const newStatus = currentStatus === "Inactive" ? "Active" : "Inactive";
    try {
      await updateExecAdmin(id, { status: newStatus });
      toast({ title: `Executive Admin is now ${newStatus}` });
      setConfirmOpen(false);
      fetchExecutives();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  // =============================
  // Search & Status Filter
  // =============================
  useEffect(() => {
    let list = executives;
    if (search.trim() !== "") {
      list = list.filter((admin) =>
        admin.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((admin) => (admin.status || "Active") === statusFilter);
    }
    setFilteredExecutives(list);
  }, [search, statusFilter, executives]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            Executive Admins
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and view Executive Admins in your network
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex justify-end">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search Executive Admins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Executive Admins</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading Executive Admins...
            </div>
          ) : filteredExecutives.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No Executive Admins found
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Phone
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Country
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">
                      <Select
                        value={statusFilter}
                        onValueChange={(val) => setStatusFilter(val)}
                      >
                        <SelectTrigger className="h-8 border-none bg-transparent hover:bg-muted p-0 pr-2 font-semibold text-sm text-foreground focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 w-auto gap-1">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Status: All</SelectItem>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Created At
                    </th>
                    <th className="text-right py-3 px-4 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExecutives.map((admin) => (
                    <tr
                      key={admin._id}
                      className="border-b hover:bg-muted/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium">{admin.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        +{admin.phone_number?.join(" ")}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {admin.country}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            admin.status === "Active" || !admin.status
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {admin.status || "Active"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(admin.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right flex items-center justify-end">
                        <Switch
                          checked={admin.status !== "Inactive"}
                          onCheckedChange={() => handleToggleStatus(admin._id, admin.status)}
                          title={admin.status === "Inactive" ? "Activate" : "Deactivate"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Status Change Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <p className="text-sm text-muted-foreground pt-2">
              Are you sure you want to set this Executive Admin to{" "}
              <span className="font-bold text-primary">
                {confirmData?.currentStatus === "Inactive" ? "Active" : "Inactive"}
              </span>
              ?
            </p>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={executeToggleStatus}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EA_ExecutiveAdmins;
