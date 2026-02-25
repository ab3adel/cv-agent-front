'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Phone, Download, FileText, Check , Clock} from 'lucide-react';
import { EMAILSTATUS } from '../helper/constants';

type Props = {
  action: string | null;
  emailContent:string |null 
  status : typeof EMAILSTATUS[keyof typeof EMAILSTATUS] | null
};

export const Actions = ({ action ,emailContent,status}: Props) => {
  const renderContent = () => {
    switch (action) {
      case 'SHOW_CONTACTS':
        return (
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <Mail size={20} />
              Mohammad's Contacts
            </h3>

            <a
              href="mailto:mohammad@email.com"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition backdrop-blur-md"
            >
              <Mail size={18} />
              mohammad@email.com
            </a>

            <a
              href="tel:+1234567890"
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition backdrop-blur-md"
            >
              <Phone size={18} />
              +1 234 567 890
            </a>
          </div>
        );

      case 'SHOW_CV':
        return (
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <FileText size={20} />
              Download CV
            </h3>

            <a
              href="/Mohammad_CV.pdf"
              download
              className="flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:scale-105 transition transform shadow-lg"
            >
              <Download size={18} />
              Download CV
            </a>
          </div>
        );

       case 'SEND_EMAIL':
  return (
    <div className="flex flex-col gap-6 p-6 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-xl max-w-xl">

      <h3 className="text-xl font-semibold text-white flex items-center gap-2">
        <Mail size={20} />
        {status === EMAILSTATUS.Pending ? 'Confirm Email':'Email Was Delievered' }
      </h3>

      <div className="bg-zinc-800 p-4 rounded-xl border border-zinc-700">
        <p className="text-sm text-zinc-400 mb-2">Message Preview:</p>
        <p className="text-white whitespace-pre-wrap">
          {emailContent}
        </p>
      </div>

      <div className="flex gap-4 justify-end">
         { status === EMAILSTATUS.Pending ? <Clock size={18} />: <Check size={18} />}

      </div>
    </div>
  );

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {action && (
        <motion.div
          key={action}
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border 
          border-white/10 shadow-2xl backdrop-blur-xl"
        >
          {renderContent()}
        </motion.div>
      )}
    </AnimatePresence>
  );
};