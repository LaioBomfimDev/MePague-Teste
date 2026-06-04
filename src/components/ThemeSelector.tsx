"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { Check, Compass, Droplets, Flame, Heart, Leaf, Monitor, Moon, Sparkles, Sun, Waves, X } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/components/ThemeProvider";

type ThemeOption = {
  accent: string;
  category: "Base" | "Rosa" | "Azul" | "Autorais";
  icon: LucideIcon;
  id: ThemeChoice;
  label: string;
  preview: {
    button: string;
    page: string;
    soft: string;
    surface: string;
    text: "black" | "white";
  };
  swatches: string[];
};

const themeOptions: ThemeOption[] = [
  {
    accent: "#111111",
    category: "Base",
    icon: Monitor,
    id: "system",
    label: "Sistema",
    preview: {
      button: "#111111",
      page: "linear-gradient(135deg, #ffffff 0 50%, #101011 50% 100%)",
      soft: "#F2F3F5",
      surface: "#FFFFFF",
      text: "black",
    },
    swatches: ["#FFFFFF", "#101011", "#007AFF"],
  },
  {
    accent: "#007AFF",
    category: "Base",
    icon: Sun,
    id: "light",
    label: "Claro",
    preview: {
      button: "#007AFF",
      page: "#FFFFFF",
      soft: "#F5F6F8",
      surface: "#FFFFFF",
      text: "black",
    },
    swatches: ["#FFFFFF", "#F5F6F8", "#007AFF"],
  },
  {
    accent: "#5B8CFF",
    category: "Base",
    icon: Moon,
    id: "dark",
    label: "Escuro",
    preview: {
      button: "#5B8CFF",
      page: "#101011",
      soft: "#27252B",
      surface: "#1B1A1D",
      text: "white",
    },
    swatches: ["#101011", "#1B1A1D", "#5B8CFF"],
  },
  {
    accent: "#DB2777",
    category: "Rosa",
    icon: Heart,
    id: "pink",
    label: "Rosa Chic",
    preview: {
      button: "#DB2777",
      page: "#FFF6FB",
      soft: "#FFF0F7",
      surface: "#FFFFFF",
      text: "black",
    },
    swatches: ["#FFF6FB", "#FFFFFF", "#DB2777"],
  },
  {
    accent: "#B00057",
    category: "Rosa",
    icon: Sparkles,
    id: "pink-full",
    label: "Rosa Total",
    preview: {
      button: "#B00057",
      page: "#FFD6E9",
      soft: "#FFC4DF",
      surface: "#FFEAF4",
      text: "black",
    },
    swatches: ["#FFD6E9", "#FFEAF4", "#B00057"],
  },
  {
    accent: "#D81B72",
    category: "Rosa",
    icon: Moon,
    id: "pink-night",
    label: "Rosa Noite",
    preview: {
      button: "#D81B72",
      page: "#240012",
      soft: "#4B0629",
      surface: "#34001B",
      text: "white",
    },
    swatches: ["#240012", "#34001B", "#D81B72"],
  },
  {
    accent: "#2563EB",
    category: "Azul",
    icon: Droplets,
    id: "blue",
    label: "Azul Clean",
    preview: {
      button: "#2563EB",
      page: "#F4F9FF",
      soft: "#EEF6FF",
      surface: "#FFFFFF",
      text: "black",
    },
    swatches: ["#F4F9FF", "#FFFFFF", "#2563EB"],
  },
  {
    accent: "#0F4FB8",
    category: "Azul",
    icon: Waves,
    id: "blue-full",
    label: "Azul Total",
    preview: {
      button: "#0F4FB8",
      page: "#DBEAFE",
      soft: "#BFD7FF",
      surface: "#EAF3FF",
      text: "black",
    },
    swatches: ["#DBEAFE", "#EAF3FF", "#0F4FB8"],
  },
  {
    accent: "#2563EB",
    category: "Azul",
    icon: Moon,
    id: "blue-night",
    label: "Azul Noite",
    preview: {
      button: "#2563EB",
      page: "#06152E",
      soft: "#123261",
      surface: "#0B2146",
      text: "white",
    },
    swatches: ["#06152E", "#0B2146", "#2563EB"],
  },
  {
    accent: "#2F7D1C",
    category: "Autorais",
    icon: Leaf,
    id: "lime-pop",
    label: "Lima Pop",
    preview: {
      button: "#2F7D1C",
      page: "linear-gradient(135deg, #F7FFE9 0 58%, #FFF1BF 58% 100%)",
      soft: "#EAF7D0",
      surface: "#FEFFF7",
      text: "black",
    },
    swatches: ["#F7FFE9", "#FFF1BF", "#2F7D1C"],
  },
  {
    accent: "#0E7C86",
    category: "Autorais",
    icon: Compass,
    id: "aurora-mint",
    label: "Aurora Menta",
    preview: {
      button: "#0E7C86",
      page: "linear-gradient(135deg, #F5FDFF 0 52%, #FFE8DD 52% 100%)",
      soft: "#E8F7F9",
      surface: "#FFFFFF",
      text: "black",
    },
    swatches: ["#F5FDFF", "#FFE8DD", "#0E7C86"],
  },
  {
    accent: "#C24135",
    category: "Autorais",
    icon: Flame,
    id: "graphite-coral",
    label: "Grafite Coral",
    preview: {
      button: "#C24135",
      page: "linear-gradient(135deg, #111716 0 58%, #20302D 58% 100%)",
      soft: "#273B36",
      surface: "#18211F",
      text: "white",
    },
    swatches: ["#111716", "#36D399", "#C24135"],
  },
];

const categories: ThemeOption["category"][] = ["Base", "Rosa", "Azul", "Autorais"];

export default function ThemeSelector() {
  const { setTheme, theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [showNeon, setShowNeon] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentOption = themeOptions.find((option) => option.id === theme) || themeOptions[0];
  const CurrentIcon = currentOption.icon;

  useEffect(() => {
    const hasSeen = localStorage.getItem("mepague_theme_shop_seen");
    if (!hasSeen) {
      setShowNeon(true);
    }
  }, []);

  const handleOpenShop = () => {
    setOpen(true);
    if (showNeon) {
      setShowNeon(false);
      localStorage.setItem("mepague_theme_shop_seen", "true");
    }
  };

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="theme-selector">
      <button
        type="button"
        className={`theme-selector__button ${showNeon ? "is-neon" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Tema: ${currentOption.label}`}
        title={`Tema: ${currentOption.label}`}
        onClick={handleOpenShop}
      >
        <CurrentIcon size={18} strokeWidth={2.1} />
        <span className="theme-selector__button-swatch" style={{ background: currentOption.accent }} aria-hidden="true" />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="app-modal theme-shop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div ref={panelRef} className="app-modal__panel theme-shop__panel" role="dialog" aria-modal="true" aria-labelledby="theme-shop-title">
            <header className="theme-shop__header">
              <div>
                <p className="theme-shop__eyebrow">Personalizacao</p>
                <h2 id="theme-shop-title" className="theme-shop__title">
                  Temas
                </h2>
              </div>
              <button type="button" className="theme-shop__close" onClick={() => setOpen(false)} aria-label="Fechar temas">
                <X size={18} />
              </button>
            </header>

            <div className="theme-shop__content">
              {categories.map((category) => (
                <section key={category} className="theme-shop__section">
                  <h3 className="theme-shop__section-title">{category}</h3>
                  <div className="theme-shop__grid">
                    {themeOptions
                      .filter((option) => option.category === category)
                      .map((option) => {
                        const Icon = option.icon;
                        const selected = option.id === theme;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={selected ? "theme-card is-selected" : "theme-card"}
                            aria-pressed={selected}
                            onClick={() => setTheme(option.id)}
                          >
                            <span className="theme-card__preview" style={{ background: option.preview.page }}>
                              <span className="theme-card__phone" style={{ background: option.preview.surface }}>
                                <span className="theme-card__topline">
                                  <span
                                    className="theme-card__avatar"
                                    style={{ background: option.preview.soft }}
                                  />
                                  <span
                                    className="theme-card__pill"
                                    style={{ background: option.preview.button }}
                                  />
                                </span>
                                <span className="theme-card__lines">
                                  <span
                                    className="theme-card__line is-strong"
                                    style={{ background: option.preview.text === "white" ? "#FFFFFF" : "#111111" }}
                                  />
                                  <span
                                    className="theme-card__line"
                                    style={{ background: option.preview.text === "white" ? "rgba(255,255,255,0.72)" : "rgba(17,17,17,0.5)" }}
                                  />
                                </span>
                                <span className="theme-card__bar" style={{ background: option.preview.button }} />
                              </span>
                            </span>

                            <span className="theme-card__body">
                              <span className="theme-card__name">
                                <Icon size={15} strokeWidth={2.2} />
                                {option.label}
                              </span>
                              <span className="theme-card__swatches" aria-hidden="true">
                                {option.swatches.map((swatch) => (
                                  <span key={swatch} className="theme-card__swatch" style={{ background: swatch }} />
                                ))}
                              </span>
                            </span>

                            <span className="theme-card__check" aria-hidden="true">
                              <Check size={15} strokeWidth={2.5} />
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </section>
              ))}
            </div>

            <footer className="theme-shop__footer">
              <button type="button" className="theme-shop__done" onClick={() => setOpen(false)}>
                Concluir
              </button>
            </footer>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
