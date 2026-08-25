export type NavigationItem = {
  label: string
  href: string
  children?: NavigationItem[]
}

export const clothingCategories: NavigationItem[] = [
  { label: "Νέες Παραλαβές", href: "/clothing/new-arrivals" },
  { label: "Φορέματα", href: "/clothing/dresses" },
  { label: "Μπλούζες", href: "/clothing/tops" },
  { label: "Παντελόνια", href: "/clothing/trousers" },
  { label: "Πανωφόρια", href: "/clothing/outerwear" },
  { label: "Τζιν", href: "/clothing/jeans" },
  { label: "Κολάν", href: "/clothing/leggings" },
  { label: "Φούστες", href: "/clothing/skirts" },
  { label: "Αθλητική Ένδυση", href: "/clothing/activewear" },
  { label: "Ολόσωμες Φόρμες", href: "/clothing/jumpsuits" },
  { label: "Πλεκτά", href: "/clothing/knitwear" },
  { label: "Μαγιώ", href: "/clothing/swimwear" },
]

export const accessoryCategories: NavigationItem[] = [
  { label: "Τσάντες", href: "/accessories/bags" },
  { label: "Ζώνες", href: "/accessories/belts" },
  { label: "Κοσμήματα", href: "/accessories/jewellery" },
  { label: "Καπέλα", href: "/accessories/hats" },
  { label: "Γυαλιά Ηλίου", href: "/accessories/sunglasses" },
  { label: "Λαστιχάκια και Κορδέλες", href: "/accessories/hair-accessories" },
]

export const designerNames = [
  "Arpyes",
  "Combos Knitwear",
  "Cutcuutur",
  "Individual Art Leather",
  "Mallory the Label",
  "Milkwhite",
  "Nashbyna",
  "Nazezhda",
  "Salt & Pepper Jeans",
  "Sun.Set.Go!",
  "Urban Owl",
  "4Tailors",
  "Zografos Concept",
  "Elena Athanasiou bags",
  "AV Sunglasses",
  "Ciel Concept",
  "Mind Matter",
  "Nidodileda",
  "Mix&Match",
  "EVERY OTHER",
]

export const primaryNavigation: NavigationItem[] = [
  { label: "Ρούχα", href: "/clothing", children: clothingCategories },
  { label: "Σχεδιαστές", href: "/designers" },
  { label: "Αξεσουάρ", href: "/accessories", children: accessoryCategories },
  { label: "Σε Προσφορά", href: "/sale" },
  { label: "Η ιστορία μας", href: "/our-story" },
]
