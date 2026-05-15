import type { InventoryItem } from "@/agent/types";

export const defaultStoreName = "Toko Kopi Senja";

export const defaultInventory: InventoryItem[] = [
  {
    id: "risol-mayo",
    name: "Risol Mayo",
    aliases: ["risol", "risol mayo"],
    price: 8000,
    stock: 18,
    lowStockThreshold: 6,
  },
  {
    id: "es-kopi-susu",
    name: "Es Kopi Susu",
    aliases: ["kopi", "es kopi", "kopi susu", "es kopi susu"],
    price: 12000,
    stock: 12,
    lowStockThreshold: 5,
  },
  {
    id: "brownies-mini",
    name: "Brownies Mini",
    aliases: ["brownies", "brownies mini"],
    price: 15000,
    stock: 4,
    lowStockThreshold: 5,
  },
  {
    id: "keripik-pedas",
    name: "Keripik Pedas",
    aliases: ["keripik", "keripik pedas"],
    price: 10000,
    stock: 9,
    lowStockThreshold: 4,
  },
];

export const defaultMessages = `[Ayu] Kak, risol mayo masih ada? Aku mau 2 risol mayo dan 1 es kopi, bisa dikirim sore ini?
[Bima] Harga risol mayo sama kopi susu berapa ya?
[Citra] Aku mau pesan 3 brownies dan 2 es kopi untuk besok pagi.
[Doni] Pesanan kemarin belum sampai, bisa dicek?`;

