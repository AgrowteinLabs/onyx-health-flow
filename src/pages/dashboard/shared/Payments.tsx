import PageHeader from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Search, Download, RefreshCw, FileText, CheckCircle2, Clock } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { listLinkedAccounts, updateLinkedAccountBank } from "@/services/linkedAccounts.service";
import { getSettlements } from "@/services/analytics.service";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const Payments = () => {
  const { toast } = useToast();
  const [linkedAccount, setLinkedAccount] = useState<any>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bankData, setBankData] = useState({
    beneficiaryName: "",
    accountNumber: "",
    ifsc: "",
  });
  const [updating, setUpdating] = useState(false);

  const fetchLinkedAccount = async () => {
    try {
      setLoadingAccount(true);
      const res = await listLinkedAccounts();
      const accounts = res.linkedAccounts || res.data || (Array.isArray(res) ? res : []);
      if (accounts.length > 0) {
        setLinkedAccount(accounts[0]);
        setBankData({
          beneficiaryName: accounts[0].bankAccount?.beneficiaryName || "",
          accountNumber: accounts[0].bankAccount?.accountNumber || "",
          ifsc: accounts[0].bankAccount?.ifsc || "",
        });
      }
    } catch (err) {
      console.error("Failed to load linked payout accounts", err);
    } finally {
      setLoadingAccount(false);
    }
  };

  useEffect(() => {
    fetchLinkedAccount();
  }, []);

  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedAccount?._id) return;
    if (!bankData.beneficiaryName || !bankData.accountNumber || !bankData.ifsc) {
      toast({ title: "Incomplete details", description: "All fields are required.", variant: "destructive" });
      return;
    }

    try {
      setUpdating(true);
      await updateLinkedAccountBank(linkedAccount._id, {
        bankAccount: {
          accountNumber: bankData.accountNumber,
          ifsc: bankData.ifsc,
          beneficiaryName: bankData.beneficiaryName,
        }
      });
      toast({ title: "Bank account updated successfully!" });
      setEditOpen(false);
      fetchLinkedAccount();
    } catch (err) {
      console.error(err);
      toast({ title: "Update failed", description: "Failed to update payout bank account details.", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSettlementsData = useCallback(async () => {
    try {
      setLoadingPayments(true);
      const res = await getSettlements().catch(() => null);
      const settlementsList = Array.isArray(res)
        ? res
        : res?.settlements || res?.data || [];

      if (settlementsList.length > 0) {
        const mapped = settlementsList.map((item: any, i: number) => {
          const rawAmt = Number(item.amount || item.payoutAmount || 0);
          return {
            id: item._id || item.id || `st-${i}`,
            invoice: item.settlementId || item.referenceId || `ST-${item._id ? item._id.slice(-6).toUpperCase() : String(i + 1).padStart(4, "0")}`,
            amount: `₹${rawAmt.toLocaleString("en-IN")}`,
            date: item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "Recent",
            method: item.method || item.payoutMethod || "Direct Bank Transfer",
            status: item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : "Paid",
          };
        });
        setPayments(mapped);
      } else {
        setPayments([]);
      }
    } catch (err) {
      console.warn("Could not load settlements:", err);
      setPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  useEffect(() => {
    fetchSettlementsData();
  }, [fetchSettlementsData]);

  const filteredPayments = payments.filter(
    (p) =>
      p.invoice.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    // <DashboardLayout>
    <div className="space-y-6">
      <PageHeader />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#14213D]">Payments</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Track payouts and manage settlement details
          </p>
        </div>
      </div>

      {/* Payout Settings Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 cols: Payout details */}
        <Card className="md:col-span-2 bg-white/70 backdrop-blur-md border border-white/60 shadow-sm rounded-[24px]">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-extrabold text-[#14213D] flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-[#35B7C9]" /> Payout Bank Settlement
              </CardTitle>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">Manage bank account for receiving medical consult earnings</p>
            </div>
            {linkedAccount && (
              <Badge className={`border-none px-2.5 py-0.5 text-[10px] font-bold ${
                linkedAccount.activationStatus === "activated" || linkedAccount.status === "active"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-amber-500/10 text-amber-600"
              }`}>
                {linkedAccount.activationStatus === "activated" || linkedAccount.status === "active" ? "Activated" : "Pending Verification"}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {loadingAccount ? (
              <div className="py-6 text-center text-slate-400 font-bold text-xs animate-pulse">Loading payout details...</div>
            ) : linkedAccount ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Beneficiary Name</p>
                    <p className="text-sm font-extrabold text-[#14213D] mt-0.5">{linkedAccount.bankAccount?.beneficiaryName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Account Number</p>
                    <p className="text-sm font-extrabold text-[#14213D] mt-0.5">
                      {linkedAccount.bankAccount?.accountNumber 
                        ? `•••• •••• ${linkedAccount.bankAccount.accountNumber.slice(-4)}`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">IFSC / Routing Code</p>
                    <p className="text-sm font-extrabold text-[#14213D] mt-0.5">{linkedAccount.bankAccount?.ifsc || "N/A"}</p>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button 
                    onClick={() => setEditOpen(true)}
                    variant="outline" 
                    className="rounded-xl border-slate-200 font-extrabold h-9 px-4 text-xs"
                  >
                    Edit Bank Details
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-xs text-slate-500 font-semibold">No payout bank account linked yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">Please complete onboarding to link your payout account.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right 1 col: Quick Info */}
        <Card className="bg-gradient-to-br from-[#14213D] to-[#1e3a5f] text-white border-none rounded-[24px] shadow-md p-6 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="font-extrabold text-sm tracking-wide text-[#35B7C9] uppercase">Settlement Info</h3>
            <p className="text-xs leading-relaxed text-slate-200/90 font-medium">
              Earnings from completed telehealth consultations are split and transferred directly to your bank account via Razorpay Route.
            </p>
          </div>
          <div className="border-t border-white/10 pt-4 mt-4">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Settlement Cycle</p>
            <p className="text-xs font-extrabold text-[#35B7C9] mt-0.5">T+2 Rolling Days</p>
          </div>
        </Card>
      </div>

      <Card className="bg-white border-slate-100 shadow-sm rounded-[24px]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment History</CardTitle>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={fetchSettlementsData}
                disabled={loadingPayments}
                className="rounded-[12px] h-9 w-9 border-slate-200"
                title="Refresh settlements"
              >
                <RefreshCw className={`h-4 w-4 text-slate-600 ${loadingPayments ? "animate-spin" : ""}`} />
              </Button>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search settlements..."
                  className="pl-10 h-9 rounded-[12px] border-slate-200 text-xs"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-extrabold text-[#14213D]">No settlement transactions found</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Earnings from completed patient consultations and transfers will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Settlement Ref</th>
                    <th className="text-left py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Method</th>
                    <th className="text-left py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-xs text-[#14213D]">{payment.invoice}</td>
                      <td className="py-3 px-4 font-extrabold text-xs text-emerald-600">
                        {payment.amount}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 font-semibold">
                        {payment.date}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px] font-bold rounded-lg border-slate-200">
                          {payment.method}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            payment.status.toLowerCase() === "paid" || payment.status.toLowerCase() === "settled"
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              : payment.status.toLowerCase() === "pending"
                              ? "bg-amber-50 text-amber-600 border border-amber-100"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Bank Payout Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[420px] rounded-[24px] border border-slate-100 bg-white p-6 shadow-xl text-[#14213D]">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-[#14213D]">Update Settlement Account</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Change the bank account where your consult payouts are processed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateBank} className="space-y-4 py-4 text-left">
            <div className="space-y-1.5">
              <Label htmlFor="beneficiaryName">Beneficiary Name *</Label>
              <Input
                id="beneficiaryName"
                value={bankData.beneficiaryName}
                onChange={(e) => setBankData({ ...bankData, beneficiaryName: e.target.value })}
                className="rounded-xl border-slate-200 h-10 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accountNumber">Account Number *</Label>
              <Input
                id="accountNumber"
                value={bankData.accountNumber}
                onChange={(e) => setBankData({ ...bankData, accountNumber: e.target.value })}
                className="rounded-xl border-slate-200 h-10 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ifsc">IFSC Code *</Label>
              <Input
                id="ifsc"
                value={bankData.ifsc}
                onChange={(e) => setBankData({ ...bankData, ifsc: e.target.value.toUpperCase() })}
                className="rounded-xl border-slate-200 h-10 text-xs"
              />
            </div>
            <DialogFooter className="pt-4 flex items-center justify-end gap-3">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setEditOpen(false)}
                className="rounded-xl h-10 px-4 font-bold text-xs"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updating}
                className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-xl h-10 px-6 font-bold shadow-md shadow-[#F2052C]/20 hover:opacity-90 text-xs min-w-[100px]"
              >
                {updating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    // </DashboardLayout>
  );
};

export default Payments;
