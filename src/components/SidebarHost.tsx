import { useState } from "react";
import AboutModal from "@/components/AboutModal";
import EditProfileModal from "@/components/EditProfileModal";
import FutureFeaturesModal from "@/components/FutureFeaturesModal";
import Sidebar from "@/components/Sidebar";
import { useSidebar } from "@/context/SidebarContext";

// Mounted once beside <Tabs> in the tab layout. Wires the existing Sidebar
// to the shared context and owns the three modals the sidebar can open —
// previously all of this state lived inside HomeScreen, which meant every
// other tab would have needed its own copy.
export default function SidebarHost() {
  const { open, closeSidebar } = useSidebar();
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [futureFeaturesOpen, setFutureFeaturesOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <Sidebar
        visible={open}
        onClose={closeSidebar}
        onEditProfile={() => {
          closeSidebar();
          setEditProfileOpen(true);
        }}
        onFutureFeatures={() => {
          closeSidebar();
          setFutureFeaturesOpen(true);
        }}
        onAbout={() => {
          closeSidebar();
          setAboutOpen(true);
        }}
      />
      <EditProfileModal
        visible={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
      />
      <FutureFeaturesModal
        visible={futureFeaturesOpen}
        onClose={() => setFutureFeaturesOpen(false)}
      />
      <AboutModal visible={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  );
}
