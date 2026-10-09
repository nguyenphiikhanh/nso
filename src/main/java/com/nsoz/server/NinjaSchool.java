package com.nsoz.server;

import java.awt.Button;
import java.awt.Color;
import java.awt.Frame;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.swing.ImageIcon;
import com.nsoz.clan.Clan;
import com.nsoz.db.jdbc.DbManager;
import com.nsoz.event.Event;
import com.nsoz.model.Char;
import com.nsoz.stall.StallManager;
import com.nsoz.util.Log;
import com.nsoz.util.NinjaUtils;

/**
 * @author ASD
 */
public class NinjaSchool extends WindowAdapter implements ActionListener {

    public static boolean isStop = false;
    private Frame frame;

    public NinjaSchool() { ///
        try {
            frame = new Frame("Quản lý");
            InputStream is = getClass().getClassLoader().getResourceAsStream("icon.png");
            byte[] data = new byte[is.available()];
            is.read(data);
            ImageIcon img = new ImageIcon(data);
            frame.setIconImage(img.getImage());
            frame.setSize(200, 380);
            frame.setBackground(Color.BLACK);
            frame.setResizable(false);
            frame.addWindowListener(this);
            Button b = new Button("Bảo trì");
            b.setBounds(30, 60, 140, 30);
            b.setActionCommand("baotri9912");
            b.addActionListener(this);
            frame.add(b);
            Button b2 = new Button("Lưu Shinwa");
            b2.setBounds(30, 100, 140, 30);
            b2.setActionCommand("shinwa99");
            b2.addActionListener(this);
            frame.add(b2);
            Button b3 = new Button("Lưu dữ liệu gia tộc");
            b3.setBounds(30, 140, 140, 30);
            b3.setActionCommand("clan99");
            b3.addActionListener(this);
            frame.add(b3);
            Button b4 = new Button("Lưu dữ liệu người chơi");
            b4.setBounds(30, 180, 140, 30);
            b4.setActionCommand("player99");
            b4.addActionListener(this);
            frame.add(b4);
            Button b5 = new Button("Làm mới TOP");
            b5.setBounds(30, 220, 140, 30);
            b5.setActionCommand("bxh99");
            b5.addActionListener(this);
            frame.add(b5);
            Button b6 = new Button("Gửi Đồ");
            b6.setBounds(30, 260, 140, 30);
            b6.setActionCommand("buff99");
            b6.addActionListener(this);
            frame.add(b6);
            Button b7 = new Button("Gửi ngọc");
            b7.setBounds(30, 300, 140, 30);
            b7.setActionCommand("addGems");
            b7.addActionListener(this);
            frame.add(b7);
            frame.setLocationRelativeTo(null);
            frame.setLayout(null);
            frame.setVisible(true);
        } catch (IOException ex) {
            Logger.getLogger(NinjaSchool.class.getName()).log(Level.SEVERE, null, ex);
        }
    }

    public static void main(String args[]) throws Exception {
        if (Config.getInstance().load()) {
            if (!DbManager.start()) {
                return;
            }
            if (NinjaUtils.availablePort(Config.getInstance().getPort())) {
                new NinjaSchool(); ///  tắt giao diện khi chạy linux
                if (!Server.init()) {
                    System.out.println("Khoi tao that bai!");
                    return;
                }
                Server.start();
            } else {
                System.out.println("Port " + Config.getInstance().getPort() + " da duoc su dung!");
            }
        } else {
            System.out.println("Vui long kiem tra lai cau hinh 1!");
        }
    }



    @Override
    public void actionPerformed(ActionEvent e) {
        if (e.getActionCommand().equals("shinwa99")) {
            if (Server.start) {
                System.out.println("Lưu Shinwa");
                StallManager.getInstance().save();
                System.out.println("Lưu shinwa xong");
            } else {
                System.out.println("Mãy chủ chưa bật");
            }
        }
        if (e.getActionCommand().equals("baotri9912")) {
            if (Server.start) {
                if (!isStop) {
                    (new Thread(new Runnable() {
                        public void run() {
                            try {
                                Server.maintance();
                                System.exit(0);
                            } catch (Exception e) {
                                Log.logException("Lỗi commanf bảo trì: ", NinjaSchool.class, e);

                            }

                        }
                    })).start();
                }

            } else {
                System.out.println("Máy chủ chưa bật.");
            }
        }
        if (e.getActionCommand().equals("clan99")) {
            System.out.println("Lưu dữ liệu gia tộc.");
            List<Clan> clans = Clan.getClanDAO().getAll();
            synchronized (clans) {
                for (Clan clan : clans) {
                    Clan.getClanDAO().update(clan);
                }
            }
            System.out.println("Lưu dữ liệu gia tộc xong");
        }
        if (e.getActionCommand().equals("bxh99")) {
            List<Char> chars = ServerManager.getChars();
            for (Char _char : chars) {
                _char.saveData();
            }
            System.out.println("Làm mới bảng xếp hạng");
            Ranked.refresh();
            System.out.println("Làm mới bảng xếp hạng xong");
        }
        if (e.getActionCommand().equals("player99")) {
            System.out.println("Lưu dữ liệu người chơi");
            List<Char> chars = ServerManager.getChars();
            for (Char _char : chars) {
                try {
                    if (_char != null && !_char.isCleaned) {
                        _char.saveData();
                        if (Event.getEvent() != null) {
                            _char.updateEventPoint();
                        }
                        if (_char.clone != null && !_char.clone.isCleaned) {
                            _char.clone.saveData();
                        }
                        if (_char.user != null && !_char.user.isCleaned) {
                            if (_char.user != null) {
                                _char.user.saveData();
                            }

                        }

                    }
                } catch (Exception ex) {
                    Log.logException("Lỗi Lưu data player action: ", NinjaSchool.class, ex);

                }
            }
            System.out.println("Lưu dữ liệu người chơi xong");
        }
        if (e.getActionCommand().equals("restartSQL99")) {
            System.out.println("Bắt đầu khởi động lại!");

            System.out.println("Khởi động xong!");
        }
        if (e.getActionCommand().equals("buff99")) {
            JFrameSendItem.run();
        }
        if (e.getActionCommand().equals("addGems")) {
            SendGems.run();
        }
    }

    public void windowClosing(WindowEvent e) {
        frame.dispose();
        if (Server.start) {
            System.out.println("Đóng máy chủ.");
            Server.stop();
            System.exit(0);
        }
    }


}
