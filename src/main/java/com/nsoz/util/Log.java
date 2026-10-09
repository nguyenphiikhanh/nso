/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package com.nsoz.util;

import com.nsoz.server.Config;
import org.apache.log4j.LogManager;
import org.apache.log4j.Logger;
import org.apache.log4j.Priority;

/**
 * @author Admin
 */
public class Log {

    private static final Logger LOG = LogManager.getLogger(Log.class);

    // Info Level Logs
    public static void info(String message) {
        System.out.println(message);
    }

    public static void info(Object object) {
        System.out.println(object);
    }

    // Warn Level Logs
    public static void warn(String message) {
        LOG.warn(message);
    }

    public static void warn(Object object) {
        LOG.warn(object);
    }

    // Error Level Logs
    public static void error(String message) {
        LOG.error(message);
    }

    public static void error(Object object) {
        LOG.error(object);
    }

    // Fatal Level Logs
    public static void fatal(String message) {
        LOG.fatal(message);
    }


    // Debug Level Logs
    public static void debug(String message) {
        if (Config.getInstance().isShowLog()) {
            LOG.debug(message);
        }
    }

    public static void debug(Object object) {
        if (Config.getInstance().isShowLog()) {
            LOG.debug(object);
        }
    }

    public static void error(String message, Throwable throwable) {
        LOG.error(message, throwable);
    }

    public static void logException(String message, Class<?> clazz, Throwable throwable) {
        StackTraceElement[] stackTraceElements = throwable.getStackTrace();
   //  throwable.printStackTrace();   /// không cho log lỗi ra cmd
        String method = "";
        int lineNumber = 0;
        if (stackTraceElements.length > 1) {
            method = stackTraceElements[1].getMethodName();
            lineNumber = stackTraceElements[1].getLineNumber();
        }else if (stackTraceElements.length == 1) {
            method = stackTraceElements[0].getMethodName();
            lineNumber = stackTraceElements[0].getLineNumber();
        } else {
            method = "Unknown method";
            lineNumber = -1;  // Giá trị mặc định nếu không có thông tin stack trace
        }
        StringBuilder   logMessage = new StringBuilder();

        logMessage.append("\n<----------------------------------------------------------------->\n[ERROR]Có lỗi xảy ra tại :\n")
                .append("Class  : ").append(clazz.getName()).append("\n")
                .append("Method : ").append(method).append("\n")
                .append("Line   : ").append(lineNumber).append("\n")
                .append("Message: ").append(message).append("\n")
                .append("Exception: ").append(throwable.toString()).append("\n")
                .append("<----------------------------------------------------------------->")
                .append("\nChi tiết lỗi: ");
        Log.error(logMessage.toString(), throwable);
    }

    public static void log(Priority priority, Object message) {
        LOG.log(priority, message);
    }

}
